// --- Haptic & Audio Feedback ---
window.audioCtx = null;
window.triggerFeedback = () => {
    if (navigator.vibrate) navigator.vibrate(40);
    try {
        if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
        const osc = window.audioCtx.createOscillator();
        const gainNode = window.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, window.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0, window.audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, window.audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, window.audioCtx.currentTime + 0.3);
        osc.connect(gainNode);
        gainNode.connect(window.audioCtx.destination);
        osc.start();
        osc.stop(window.audioCtx.currentTime + 0.35);
    } catch(e) {}
};
// Service Worker Registration for PWA (Android Install)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(console.error);
    });
}

// Ana sayfaya dönüldüğünde admin yetkisini otomatik olarak sıfırla (Çıkış Yap)
sessionStorage.removeItem('isAdmin');

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEqLYUevIJCcLrJa-05MXx5ik-QFouq9o",
  authDomain: "arizabildirim-89dfa.firebaseapp.com",
  projectId: "arizabildirim-89dfa",
  storageBucket: "arizabildirim-89dfa.firebasestorage.app",
  messagingSenderId: "106785239667",
  appId: "1:106785239667:web:ab131b6a11d8133a537006"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// Çevrimdışı (Offline) Desteği
db.enablePersistence()
  .catch(function(err) {
      if (err.code == 'failed-precondition') {
          console.warn("Çoklu sekme açık, offline mod tek sekmede çalışır.");
      } else if (err.code == 'unimplemented') {
          console.warn("Tarayıcı offline modu desteklemiyor.");
      }
  });
const storage = firebase.storage();

// Admin Panelinden Ayarları (Listeleri) Çekip Dropdown'ları Doldur
const settingsRef = db.collection('ayarlar');
const dropdownMap = {
    'departments': 'costCenter',
    // 'machines': 'machine', -> Makineler artık bölüme göre dinamik gelecek
    'shifts': 'shift',
    'jobTypes': 'jobType'
};

// Bağımsız listeleri doldur
Object.keys(dropdownMap).forEach(cat => {
    settingsRef.doc(cat).onSnapshot(doc => {
        const selectEl = document.getElementById(dropdownMap[cat]);
        if (selectEl && doc.exists) {
            const list = doc.data().list || [];
            selectEl.innerHTML = '<option value="">Seçiniz...</option>'; // Always reset first
            if (list.length > 0) {
                list.sort().forEach(item => {
                    const opt = document.createElement('option');
                    opt.value = item;
                    opt.textContent = item;
                    selectEl.appendChild(opt);
                });
            }
        }
    });
});

// Maliyet Merkezi -> Makine Dinamik İlişkisi
let currentMachineMap = {};
const costCenterSelect = document.getElementById('costCenter');
const machineSelect = document.getElementById('machine');

// Eşleştirme haritasını veritabanından dinle
settingsRef.doc('machineMap').onSnapshot(doc => {
    if (doc.exists) {
        currentMachineMap = doc.data();
    }
});

// Bölüm seçildiğinde makineleri güncelle
costCenterSelect.addEventListener('change', (e) => {
    const selectedDept = e.target.value;
    machineSelect.innerHTML = '<option value="">Önce Bölüm Seçiniz...</option>';
    
    if (selectedDept && currentMachineMap[selectedDept]) {
        machineSelect.innerHTML = '<option value="">Makine Seçiniz...</option>';
        const machList = currentMachineMap[selectedDept];
        machList.sort().forEach(mach => {
            const opt = document.createElement('option');
            opt.value = mach;
            opt.textContent = mach;
            machineSelect.appendChild(opt);
        });
    }
});

// Fotoğraf Sıkıştırma Fonksiyonu (5MB dosyayı 200KB'a düşürür)
async function compressImage(file, maxWidth = 1024) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // %80 kalite ile JPEG olarak sıkıştır
                canvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

const form = document.getElementById('faultForm');
const submitBtn = document.getElementById('submitBtn');

// Yeni Gönderim Modalı Elementleri
const submissionModal = document.getElementById('submissionModal');
const loadingState = document.getElementById('loadingState');
const successState = document.getElementById('successState');
const loadingSubText = document.getElementById('loadingSubText');
const closeCountdown = document.getElementById('closeCountdown');
let closeCountdownTimer = null;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Yükleniyor ekranını aç
    submissionModal.classList.remove('hidden');
    loadingState.classList.remove('hidden');
    successState.classList.add('hidden');
    loadingSubText.innerText = "Sistemle bağlantı kuruluyor...";

    try {
        let photoUrl = "";
        
        // Fotoğraf seçildiyse işle (Kamera veya Dosyadan)
        const cameraFile = document.getElementById('cameraInput') ? document.getElementById('cameraInput').files[0] : null;
        const folderFile = document.getElementById('fileInput') ? document.getElementById('fileInput').files[0] : null;
        const photoFile = cameraFile || folderFile;
        
        if (photoFile) {
            loadingSubText.innerText = "Fotoğraf Sıkıştırılıyor...";
            const compressedBlob = await compressImage(photoFile);
            
            loadingSubText.innerText = "Fotoğraf Yükleniyor...";
            const storageRef = storage.ref('ariza_fotolari/' + Date.now() + '.jpg');
            await storageRef.put(compressedBlob);
            photoUrl = await storageRef.getDownloadURL();
        }

        loadingSubText.innerText = "Kayıt Oluşturuluyor...";

        const faultData = {
            userName: document.getElementById('userName').value,
            costCenter: document.getElementById('costCenter').value,
            machine: document.getElementById('machine').value,
            shift: document.getElementById('shift').value,
            jobType: document.getElementById('jobType').value,
            description: document.getElementById('description').value,
            photoUrl: photoUrl,
            status: 'Açık',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            resolvedData: null
        };

                await db.collection("arizalar").add(faultData);

        // Yeni Arıza Bildirimini Web3Forms veya Webhook (Google Apps Script) ile Mail At
        try {
            const mailDoc = await db.collection('ayarlar').doc('adminEmail').get();
            if (mailDoc.exists && mailDoc.data().key && mailDoc.data().faultMailEnabled !== false) {
                const accessKey = mailDoc.data().key;
                const dashboardLink = window.location.href.replace('index.html', '') + 'index.html';
                const faultTypeStr = faultData.jobType ? faultData.jobType.toUpperCase() : "ARIZA BİLDİRİMİ";
                const targetEmail = mailDoc.data().targetEmail || "";
                
                if (accessKey.startsWith("http")) {
                    // Google Apps Script (Kendi Mail Sunucusu)
                    fetch(accessKey, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            type: 'fault',
                            targetEmail: targetEmail,
                            subject: faultData.machine || "Yeni Arıza",
                            from_name: faultTypeStr,
                            description: faultData.description,
                            userName: faultData.userName,
                            shift: faultData.shift,
                            link: dashboardLink
                        })
                    }).catch(e=>console.log(e));
                } else {
                    // Web3Forms kullanımı
                    fetch('https://api.web3forms.com/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({
                            access_key: accessKey,
                            subject: faultData.machine || "Yeni Arıza",
                            from_name: faultTypeStr,
                            message: faultData.description,
                            "Bildiren Personel": faultData.userName,
                            "Çalışılan Vardiya": faultData.shift,
                            "Sisteme Giriş Linki": dashboardLink
                        })
                    }).catch(e=>console.log(e));
                }
            }
        } catch(e) { console.log(e); }

        // Gönderim Başarılı -> Modal'ın 2. Aşamasını Aç
        loadingState.classList.add('hidden');
        successState.classList.remove('hidden');
        
        // Formu Arka Planda Sıfırla
        form.reset();
        window.resetStepper();
        
        // 10 Saniyelik Otomatik Kapatma Sayacı
        let secondsLeft = 10;
        closeCountdown.innerText = secondsLeft;
        
        clearInterval(closeCountdownTimer);
        closeCountdownTimer = setInterval(() => {
            secondsLeft--;
            closeCountdown.innerText = secondsLeft;
            if (secondsLeft <= 0) {
                clearInterval(closeCountdownTimer);
                window.closeSystem();
            }
        }, 1000);

    } catch (error) {
        console.error("Hata: ", error);
        // Hata durumunda sadece modalı kapat (veya konsola yaz)
        submissionModal.classList.add('hidden');
    }
});

// Modal İçi Butonların Fonksiyonları
window.startNewForm = () => {
    clearInterval(closeCountdownTimer);
    submissionModal.classList.add('hidden');
    window.resetStepper();
};

window.closeSystem = () => {
    clearInterval(closeCountdownTimer);
    // Genellikle tarayıcılar JS ile açılmayan pencereleri window.close() ile kapatmaya izin vermez.
    // Bu yüzden pencereyi kapatmayı dener, olmazsa ekranı tamamen siyaha çevirir veya "Kapatabilirsiniz" mesajı verir.
    document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; width:100vw; background:#000; color:#fff; flex-direction:column; font-family:sans-serif;"><h2 style="margin-bottom:1rem;">Sistem Kapatıldı</h2><p style="color:#aaa;">Bu sekmeyi güvenle kapatabilirsiniz.</p></div>';
    window.close(); 
};

// Doldurulan form alanlarının (input, select, textarea) yanıp sönmesi için dinleyici
document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('input, select, textarea');
    
    const checkFilled = (el) => {
        if (el.value && el.value.trim() !== '') {
            el.classList.add('input-filled');
        } else {
            el.classList.remove('input-filled');
        }
    };

    inputs.forEach(el => {
        el.addEventListener('input', () => checkFilled(el));
        el.addEventListener('change', () => checkFilled(el));
        // Sayfa yüklendiğinde mevcut doluları da kontrol et (Örn: tarayıcı otomatik doldurduysa)
        checkFilled(el);
    });

    // Açılır Listeler (Select) için Otomatik İlerleme (Auto-Advance)
    document.querySelectorAll('select').forEach(select => {
        select.addEventListener('change', (e) => {
            if (!e.target.value) return; // Eğer 'Seçiniz' boş kalırsa işlem yapma
            
            const stepContainer = e.target.closest('.card-step');
            if (!stepContainer) return;
            
            const stepNum = parseInt(stepContainer.id.replace('step', ''));
            const stepInputs = Array.from(stepContainer.querySelectorAll('input:not([type="hidden"]), select, textarea'));
            const currentIndex = stepInputs.indexOf(e.target);
            
            if (currentIndex >= 0 && currentIndex < stepInputs.length - 1) {
                // Aynı adımda sıradaki giriş alanına geç (Örn: Bölüm seçilince Makine'ye odaklan)
                setTimeout(() => {
                    stepInputs[currentIndex + 1].focus();
                }, 100);
            } else {
                // Bu adımdaki son liste seçildi, doğrudan bir sonraki adıma (merdivene) atla
                setTimeout(() => {
                    window.nextStep(stepNum);
                }, 250);
            }
        });
    });

    // Fotoğraf Modalı ve Seçim İşlemleri
    const openPhotoModalBtn = document.getElementById('openPhotoModalBtn');
    const photoSelectionModal = document.getElementById('photoSelectionModal');
    const cameraInput = document.getElementById('cameraInput');
    const fileInput = document.getElementById('fileInput');
    const photoCompactText = document.getElementById('photoCompactText');

    if (openPhotoModalBtn && photoSelectionModal) {
        openPhotoModalBtn.addEventListener('click', () => {
            photoSelectionModal.classList.remove('hidden');
        });

        const handlePhotoSelection = (e, otherInput) => {
            if (e.target.files && e.target.files.length > 0) {
                // Diğer input'u temizle (çakışmayı önlemek için)
                otherInput.value = "";
                
                const fileName = e.target.files[0].name;
                photoCompactText.innerText = "✅ " + fileName;
                openPhotoModalBtn.style.background = "rgba(16, 185, 129, 0.1)";
                openPhotoModalBtn.style.borderColor = "var(--success)";
                openPhotoModalBtn.style.color = "var(--success)";
                
                // Seçim yapıldıktan sonra modalı kapat
                setTimeout(() => {
                    photoSelectionModal.classList.add('hidden');
                }, 300);
            }
        };

        if (cameraInput && fileInput) {
            cameraInput.addEventListener('change', (e) => handlePhotoSelection(e, fileInput));
            fileInput.addEventListener('change', (e) => handlePhotoSelection(e, cameraInput));
        }
    }
});
// --- Çok Adımlı Form (Stepper) Mantığı ---

window.goToStep = (step) => {
    const currentActiveCard = document.querySelector('.card-step.active');
    const currentActiveNav = document.querySelector('.step-item.active');
    
    if (currentActiveCard) {
        const currentStepNum = parseInt(currentActiveCard.id.replace('step', ''));
        if (currentStepNum === step) return;
        
        // Sadece ileri gidiyorsa doğrula
        if (step > currentStepNum) {
            if (!validateStep(currentStepNum)) return;
            // Aradaki adımları da doğrula (atlama durumunda)
            for(let i = currentStepNum + 1; i < step; i++){
                if (!validateStep(i)) return; // Önceki adım hatalıysa ileri atlayamaz
            }
        }
        
        currentActiveCard.classList.remove('active');
        if(currentActiveNav) currentActiveNav.classList.remove('active');
    }
    
    const targetCard = document.getElementById(`step${step}`);
    const targetNav = document.getElementById('nav-step' + step);
    
    if(targetCard && targetNav) {
        targetCard.classList.add('active');
        targetNav.classList.add('active');
        
        targetNav.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        

        
        const firstInput = targetCard.querySelector('input, select, textarea');
        if(firstInput && !firstInput.dataset.customized) setTimeout(() => firstInput.focus(), 300);
    }
};

window.nextStep = (currentStepNum) => {
    window.triggerFeedback();
    if (validateStep(currentStepNum)) {
        if (currentStepNum === 6) {
            window.showSummaryOverlay();
        } else {
            goToStep(currentStepNum + 1);
        }
    }
};

window.showSummaryOverlay = () => {
    document.getElementById('sum-name').innerText = document.getElementById('userName').value || '-';
    const cc = document.getElementById('costCenter');
    document.getElementById('sum-dept').innerText = (cc && cc.selectedIndex >= 0) ? cc.options[cc.selectedIndex].text : '-';
    const mach = document.getElementById('machine');
    document.getElementById('sum-mach').innerText = (mach && mach.selectedIndex >= 0) ? mach.options[mach.selectedIndex].text : '-';
    const sh = document.getElementById('shift');
    document.getElementById('sum-shift').innerText = (sh && sh.selectedIndex >= 0) ? sh.options[sh.selectedIndex].text : '-';
    const jt = document.getElementById('jobType');
    const overlay = document.getElementById('summaryOverlay');
    const tIcons = overlay.querySelectorAll('.t-icon');
    
    if (jt && jt.selectedIndex >= 0) {
        const jobText = jt.options[jt.selectedIndex].text;
        document.getElementById('sum-job').innerText = jobText;
        
        const checkText = jobText.toUpperCase();
        if (checkText.includes('İSG') || checkText.includes('ISG') || checkText.includes('GÜVEN') || checkText.includes('GUVEN') || checkText.includes('IS GUVENLIGI')) {
            overlay.classList.add('is-isg');
            overlay.classList.remove('is-normal');
        } else {
            overlay.classList.remove('is-isg');
            overlay.classList.add('is-normal');
        }
    } else {
        document.getElementById('sum-job').innerText = '-';
        overlay.classList.remove('is-isg');
        overlay.classList.add('is-normal');
    }
    document.getElementById('sum-desc').innerText = document.getElementById('description').value || '-';
    
    document.getElementById('summaryOverlay').classList.remove('hidden');
};

window.closeSummaryOverlay = () => {
    window.triggerFeedback();
    document.getElementById('summaryOverlay').classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('submitBtnOverlay');
    if(btn) {
        btn.addEventListener('click', () => {
            window.triggerFeedback();
            // Programmatically submit the form
            document.getElementById('faultForm').requestSubmit();
        });
    }
});

const validateStep = (step) => {
    const container = document.getElementById('step' + step);
    if (!container) return true;
    
    const inputs = container.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(el => {
        let targetEl = el;
        if (el.dataset.customized) {
            const wrapper = el.nextElementSibling;
            if (wrapper && wrapper.classList.contains('custom-select-wrapper')) {
                targetEl = wrapper.querySelector('input');
            }
        }
        
        if (!el.value.trim()) {
            if(targetEl) {
                targetEl.style.borderColor = 'var(--danger)';
                targetEl.classList.add('shake');
                setTimeout(() => targetEl.classList.remove('shake'), 500);
            }
            isValid = false;
        } else {
            if(targetEl) targetEl.style.borderColor = ''; 
        }
    });
    return isValid;
};

// Form submit başarılı olduğunda veya güç butonuna basıldığında ilk adıma döndür
window.resetStepper = () => {
    const overlay = document.getElementById('summaryOverlay');
    if(overlay) overlay.classList.add('hidden');
    document.querySelectorAll('.card-step').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById('step1').classList.add('active');
    document.getElementById('nav-step1').classList.add('active');
    
    document.getElementById('nav-step1').scrollIntoView({ behavior: 'smooth', inline: 'center' });
    
    // Fotoğraf Butonunu ve Seçimlerini Sıfırla
    const openPhotoModalBtn = document.getElementById('openPhotoModalBtn');
    if (openPhotoModalBtn) {
        document.getElementById('photoCompactText').innerText = "Fotoğraf Ekle (Opsiyonel)";
        openPhotoModalBtn.style.color = "var(--text-secondary)";
        openPhotoModalBtn.style.background = "transparent";
        openPhotoModalBtn.style.borderColor = "var(--input-border)";
        
        const cameraInput = document.getElementById('cameraInput');
        const fileInput = document.getElementById('fileInput');
        if(cameraInput) cameraInput.value = "";
        if(fileInput) fileInput.value = "";
    }
    
    // Formu temizle
    document.getElementById('faultForm').reset();
};

window.adminLogin = async () => {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('adminPasswordInput').value = '';
        setTimeout(() => document.getElementById('adminPasswordInput').focus(), 100);
    }
};

window.closeAdminLogin = () => {
    const modal = document.getElementById('adminLoginModal');
    if (modal) modal.classList.add('hidden');
};

window.submitAdminModalLogin = () => {
    const passInput = document.getElementById('adminPasswordInput');
    if (passInput.value === "12345") { 
        sessionStorage.setItem("isAdmin", "true");
        
        // Admin Giriş Yaptığında Mail Gönderimi (Bekletmeden arka planda)
        db.collection('ayarlar').doc('adminEmail').get().then(mailDoc => {
            if (mailDoc.exists && mailDoc.data().key && mailDoc.data().loginMailEnabled !== false) {
                const accessKey = mailDoc.data().key;
                const targetEmail = mailDoc.data().targetEmail || "";
                
                if(accessKey.startsWith("http")) {
                    fetch(accessKey, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            type: 'login',
                            targetEmail: targetEmail,
                            subject: "⚠️ Admin Girişi",
                            description: `Sisteminize an itibariyle şifre ile başarılı bir Admin girişi yapılmıştır.\nTarih: ${new Date().toLocaleString('tr-TR')}`
                        })
                    }).catch(e=>console.log(e));
                } else {
                    fetch('https://api.web3forms.com/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({
                            access_key: accessKey,
                            subject: "⚠️ SİSTEM GÜVENLİĞİ: Ana Sayfadan Admin Paneline Giriş Yapıldı",
                            from_name: "Bakım Sistemi",
                            email: "sistem@bildirim.com",
                            message: `Sisteminize (Ana Sayfa üzerinden) şifre ile başarılı bir Admin girişi yapılmıştır.\nTarih: ${new Date().toLocaleString('tr-TR')}`
                        })
                    }).catch(e=>console.log(e));
                }
            }
        }).catch(e => console.log("Mail gönderilemedi."));

        window.location.href = "admin.html";
    } else {
        alert("Hatalı şifre!");
        passInput.value = "";
        passInput.focus();
    }
};

// Gönder Butonu Görünürlük ve Neon Kontrolü
const descriptionInput = document.getElementById('description');
const submitNeonBtn = document.getElementById('submitBtn');
const navCenterWrap = document.querySelector('.nav-center-wrap');

if (descriptionInput) {
    descriptionInput.addEventListener('input', function() {
        if (this.value.trim().length > 3) {
            if(submitNeonBtn) submitNeonBtn.classList.add('ready-to-submit');
            if(navCenterWrap) navCenterWrap.classList.add('show-btn');
        } else {
            if(submitNeonBtn) submitNeonBtn.classList.remove('ready-to-submit');
            if(navCenterWrap) navCenterWrap.classList.remove('show-btn');
        }
    });
}

// --- OTOMATİK GOOGLE SHEETS SENKRONİZASYONU ---
// Günde 1 kez ilk giren kişi üzerinden listeleri günceller
async function autoSyncGoogleSheet() {
    try {
        const todayStr = new Date().toLocaleDateString('tr-TR'); // Örn: 12.06.2026
        const syncRef = db.collection('ayarlar').doc('lastSync');
        const doc = await syncRef.get();
        
        if (doc.exists && doc.data().date === todayStr) {
            return; // Bugün zaten güncellenmiş
        }

        // Aynı anda birden fazla cihazın güncellemesini önlemek için tarihi hemen yazalım
        await syncRef.set({ date: todayStr, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        
        console.log("Google Sheets otomatik senkronizasyon başlatılıyor...");
        
                // YENİ: JSONP ile Google GViz API üzerinden doğrudan veri çekme (Proxysiz, CORS engeli yok)
        const fetchGVizJSONP = (url) => new Promise((resolve, reject) => {
            const cb = 'gviz_' + Math.round(Math.random() * 1000000);
            window[cb] = (data) => {
                delete window[cb];
                document.body.removeChild(script);
                resolve(data);
            };
            const script = document.createElement('script');
            script.src = url.replace('tqx=out:json', 'tqx=out:json;responseHandler:' + cb);
            script.onerror = () => reject(new Error('JSONP başarisiz'));
            document.body.appendChild(script);
        });

        const sheetUrl = "https://docs.google.com/spreadsheets/d/1n4FONdt1lCVZ9MwNzkw3O3ljs97nWVshz6Ke6Sn7_zY/gviz/tq?tqx=out:json&gid=1434126787";
        const data = await fetchGVizJSONP(sheetUrl);
        
        const sheetUrl2 = "https://docs.google.com/spreadsheets/d/17SimRKvaSCkCSTQcW8rQzn-xgJX9lpYE0t6FME_qANA/gviz/tq?tqx=out:json&gid=149476655";
        let data2 = null;
        try {
            data2 = await fetchGVizJSONP(sheetUrl2);
        } catch(err) {
            console.warn("2. tablo alinamadi: ", err);
        }

        if (!data || !data.table || !data.table.rows) throw new Error("Veri alinamadi.");

        const departments = new Set();
        const machines = new Set();
        const machineMap = {};
        
        const jobTypes = new Set();
        const shifts = new Set();

        const rawRows = data.table.rows;
        const rows = [];
        for(let r of rawRows) {
            if(r.c) rows.push(r.c);
        }

        for (let i = 0; i < rows.length; i++) {
            let cols = rows[i];
            if (cols.length >= 3) {
                let dept = cols[1] && cols[1].v ? String(cols[1].v).trim().replace(/\n/g, ' ') : '';
                let mach = cols[2] && cols[2].v ? String(cols[2].v).trim().replace(/\n/g, ' ') : '';
                
                if (dept && dept !== 'MALİYET MERKEZİ' && !dept.includes("37")) {
                    dept = dept.toUpperCase();
                    departments.add(dept);
                    
                    if (mach && mach !== 'MAKİNE ADI' && !mach.includes("37")) {
                        mach = mach.toUpperCase();
                        machines.add(mach);
                        
                        if (!machineMap[dept]) machineMap[dept] = new Set();
                        machineMap[dept].add(mach);
                    }
                }
            }
        }

        const deptArray = Array.from(departments);
        const machArray = Array.from(machines);
        const finalMap = {};
        Object.keys(machineMap).forEach(k => { finalMap[k] = Array.from(machineMap[k]); });

        if (data2 && data2.table && data2.table.rows) {
            for (let r of data2.table.rows) {
                if (r.c) {
                    let jt = r.c[6] && r.c[6].v ? String(r.c[6].v).trim().replace(/\n/g, ' ') : '';
                    if (jt && jt !== 'İŞ İSTEK TÜRÜ') jobTypes.add(jt.toUpperCase());
                    
                    let sh = r.c[7] && r.c[7].v ? String(r.c[7].v).trim().replace(/\n/g, ' ') : '';
                    if (sh && sh !== 'VARDİYA' && sh !== 'VARDIYA') shifts.add(sh.toUpperCase());
                }
            }
        }

        const jobTypeArray = Array.from(jobTypes);
        const shiftArray = Array.from(shifts);

        if (deptArray.length > 0) await db.collection('ayarlar').doc('departments').set({ list: deptArray });
        if (machArray.length > 0) await db.collection('ayarlar').doc('machines').set({ list: machArray });
        if (Object.keys(finalMap).length > 0) await db.collection('ayarlar').doc('machineMap').set(finalMap);
        if (jobTypeArray.length > 0) await db.collection('ayarlar').doc('jobTypes').set({ list: jobTypeArray });
        if (shiftArray.length > 0) await db.collection('ayarlar').doc('shifts').set({ list: shiftArray });
        
        console.log("Google Sheets otomatik senkronizasyon tamamlandı.");
    } catch (err) {
        console.error("Otomatik senkronizasyon başarısız:", err);
    }
}

// Uygulama açıldığında otomatik senkronizasyonu tetikle
setTimeout(() => {
    autoSyncGoogleSheet();
}, 1000);






// --- Custom Select Searchable List ---
function makeSelectSearchable(selectId) {
    const select = document.getElementById(selectId);
    if (!select || select.dataset.customized) return;
    select.dataset.customized = "true";
    
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select-wrapper';
    const list = document.createElement('div');
    list.className = 'custom-select-list';
    
    
    wrapper.appendChild(list);
    
    select.parentNode.insertBefore(wrapper, select.nextSibling);
    select.style.display = 'none';
    
    const render = (filter = '') => {
        list.innerHTML = '';
        const searchVal = filter.toLowerCase("tr-TR");
        Array.from(select.options).forEach(opt => {
            if (opt.value === '') return;
            if (opt.text.toLowerCase("tr-TR").includes(searchVal)) {
                const item = document.createElement('div');
                item.className = 'custom-select-item';
                if(select.value === opt.value) item.classList.add('selected');
                item.innerText = opt.text;
                item.onclick = () => {
                    window.triggerFeedback();
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change'));
                    list.querySelectorAll('.custom-select-item').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    
                    const stepEl = select.closest('.card-step');
                    if(stepEl) {
                        const currentStep = parseInt(stepEl.id.replace('step', ''));
                        setTimeout(() => window.nextStep(currentStep), 200);
                    }
                };
                list.appendChild(item);
            }
        });
    };
    
    
    
    const observer = new MutationObserver(() => render());
    observer.observe(select, { childList: true });
    
    render();
}

setTimeout(() => {
    ['costCenter', 'machine', 'shift', 'jobType'].forEach(id => makeSelectSearchable(id));
}, 500);

















// --- SIDE MENU LOGIC ---
window.toggleMenu = () => {
    const menu = document.getElementById('sideMenu');
    const overlay = document.getElementById('menuOverlay');
    if (!menu || !overlay) return;
    
    menu.classList.toggle('open');
    if (menu.classList.contains('open')) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
};

window.menuAction = (action) => {
    if (action === 'home') {
        window.resetStepper();
    } else if (action === 'admin') {
        // adminModal is actually adminLoginModal in index.html
        const adminModal = document.getElementById('adminLoginModal');
        if (adminModal) {
            adminModal.classList.remove('hidden');
            setTimeout(() => document.getElementById('adminPasswordInput').focus(), 100);
        }
    } else if (action === 'board') {
        const boardModal = document.getElementById('faultBoardModal');
        if (boardModal) {
            boardModal.classList.remove('hidden');
            loadFaultBoard();
        }
    } else if (action === 'sendMessage') {
        document.getElementById('messageModal').classList.remove('hidden');
        setTimeout(() => document.getElementById('msgSenderName').focus(), 100);
    }
};

window.loadFaultBoard = async () => {
    const tableHeader = document.getElementById('faultBoardTableHeader');
    const tableBody = document.getElementById('faultBoardTableBody');
    const loadingDiv = document.getElementById('faultBoardLoading');
    
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    loadingDiv.style.display = 'block';

    try {
        // 1. Ayarları al
        let settings = {
            colDate: true, colName: true, colDept: true, 
            colMachine: true, colShift: false, colJobType: false, colDesc: true
        };
        const settingsDoc = await db.collection('ayarlar').doc('boardSettings').get();
        if (settingsDoc.exists) {
            settings = { ...settings, ...settingsDoc.data() };
        }

        // 2. Tablo Başlıklarını Oluştur
        let headersHTML = '';
        if (settings.colDate) headersHTML += '<th style="padding: 6px; border-bottom: 2px solid #ddd;">Tarih/Saat</th>';
        if (settings.colName) headersHTML += '<th style="padding: 6px; border-bottom: 2px solid #ddd;">Bildiren Kişi</th>';
        if (settings.colDept) headersHTML += '<th style="padding: 6px; border-bottom: 2px solid #ddd;">Departman</th>';
        if (settings.colMachine) headersHTML += '<th style="padding: 6px; border-bottom: 2px solid #ddd;">Makine</th>';
        if (settings.colShift) headersHTML += '<th style="padding: 6px; border-bottom: 2px solid #ddd;">Vardiya</th>';
        if (settings.colJobType) headersHTML += '<th style="padding: 6px; border-bottom: 2px solid #ddd;">İş Tipi</th>';
        if (settings.colDesc) headersHTML += '<th style="padding: 6px; border-bottom: 2px solid #ddd;">Arıza Açıklaması</th>';
        tableHeader.innerHTML = headersHTML;

        // 3. Sadece Açık Arızaları Getir
        // Firebase index hatasını önlemek için orderBy'ı yerel olarak yapacağız
        const snapshot = await db.collection('arizalar').where('status', '==', 'Açık').get();
        
        loadingDiv.style.display = 'none';

        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#666;">Şu an açık arıza bulunmamaktadır. 🎉</td></tr>`;
            return;
        }

        // Verileri al ve timestamp'e göre azalan (yeniden eskiye) sırala
        const docs = [];
        snapshot.forEach(doc => docs.push(doc.data()));
        docs.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toMillis() : 0;
            const timeB = b.timestamp ? b.timestamp.toMillis() : 0;
            return timeB - timeA;
        });

        // 4. Verileri Tabloya Yaz
        let rowsHTML = '';
        docs.forEach(data => {
            // Tarih verisini hem eski hem yeni formata göre al
            let dateStr = '-';
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                dateStr = data.createdAt.toDate().toLocaleString('tr-TR');
            } else if (data.timestamp) {
                if (typeof data.timestamp === 'string') {
                    dateStr = new Date(data.timestamp).toLocaleString('tr-TR');
                } else if (typeof data.timestamp.toDate === 'function') {
                    dateStr = data.timestamp.toDate().toLocaleString('tr-TR');
                }
            } else if (data.tarih_saat) {
                dateStr = data.tarih_saat;
            }

            const name = data.userName || data.bildiren || data.name || '-';
            const dept = data.costCenter || data.department || '-';
            const machine = data.machine || data.makine || '-';
            const shift = data.shift || data.vardiya || '-';
            const jobType = data.jobType || data.ariza_tipi || '-';
            const desc = data.description || data.aciklama || '-';
            
            rowsHTML += '<tr style="border-bottom: 1px solid #eee;">';
            if (settings.colDate) rowsHTML += `<td style="padding: 6px;">${dateStr}</td>`;
            if (settings.colName) rowsHTML += `<td style="padding: 6px;">${name}</td>`;
            if (settings.colDept) rowsHTML += `<td style="padding: 6px;">${dept}</td>`;
            if (settings.colMachine) rowsHTML += `<td style="padding: 6px;">${machine}</td>`;
            if (settings.colShift) rowsHTML += `<td style="padding: 6px;">${shift}</td>`;
            if (settings.colJobType) rowsHTML += `<td style="padding: 6px;">${jobType}</td>`;
            if (settings.colDesc) rowsHTML += `<td style="padding: 6px;">${desc}</td>`;
            rowsHTML += '</tr>';
        });

        tableBody.innerHTML = rowsHTML;

    } catch (err) {
        console.error("Pano yüklenirken hata:", err);
        loadingDiv.innerText = "Veriler yüklenirken bir hata oluştu!";
        // Hata durumunda index bazlı orderBy hatası olabilir (Firebase index istiyor olabilir).
        // Index yoksa alert verip console.log'dan linki tıklamalarını hatırlatmalıyız, ancak 
        // orderBy olmadan basit getirip js'de sıralamak daha güvenli (aylık bakım olduğu için sayı azdır).
    }
};



// --- BAKIM EKIBINE MESAJ GONDER ---
window.sendOpMessage = async () => {
    const sendBtn = document.querySelector('.wa-send-btn');
    if (sendBtn && sendBtn.disabled) return; // Zaten gönderiliyor

    const msgInput = document.getElementById('msgContent');
    const msg = msgInput.value.trim();
    
    if (msg.length < 5) {
        alert("Lütfen en az 5 harflik bir mesaj yazın.");
        return;
    }
    
    // Butonu pasifleştir
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
    }
    
    // Add sent bubble to UI immediately
    const chatBody = document.getElementById('waChatBody');
    if (chatBody) {
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const bubbleHtml = `
            <div class="wa-message wa-sent">
                <div class="wa-message-text">${msg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                <div class="wa-message-time">${timeStr} <svg class="wa-tick" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:-2px;"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
            </div>
        `;
        chatBody.insertAdjacentHTML('beforeend', bubbleHtml);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
    
    try {
        let opsList = [];
        try {
            const opsDoc = await db.collection("ayarlar").doc("operators").get();
            if (opsDoc.exists && opsDoc.data().list) {
                opsList = opsDoc.data().list;
                if (!opsList.includes("Admin")) {
                    opsList.push("Admin");
                }
            }
        } catch(err) {
            console.log("Ops err", err);
        }

        const trMonths = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
        const now = new Date();
        const dateStr = `${now.getDate()} ${trMonths[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} UTC+3`;

                        await db.collection("mesajlar").add({
            isim: "Sahadan Bildirim",
            gonderen: "Sahadan Bildirim",
            sender: "Sahadan Bildirim", // Eski sistem uyumlulugu icin
            mesaj: msg,
            text: msg, // Eski sistem uyumlulugu icin
            tarih: dateStr,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            metin: msg,
            hedefKullanicilar: opsList,
            oku: [],
            "olusturulma tarihi": firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Bakim Operatorlerinin kullandigi 'messages' tablosuna da aynisini yaziyoruz (Ops Panel uyumu)
        await db.collection("messages").add({
            sender: "Sahadan Bildirim",
            text: msg,
            targetUsers: opsList, // Ops paneli targetUsers kullaniyor
            readBy: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Change single tick to double blue tick
        if (chatBody) {
            const lastTick = chatBody.querySelector('.wa-sent:last-child .wa-tick');
            if (lastTick) {
                lastTick.outerHTML = '<svg class="wa-tick" viewBox="0 0 24 24" width="14" height="14" stroke="#53bdeb" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:-2px;"><polyline points="18 6 7 17 2 12"></polyline><polyline points="22 10 11 21 7 17"></polyline></svg>';
            }
        }
        
        // Custom WhatsApp style Toast instead of alert
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        toast.style.color = 'white';
        toast.style.padding = '15px 30px';
        toast.style.borderRadius = '30px';
        toast.style.fontSize = '1.2rem';
        toast.style.zIndex = '9999';
        toast.style.transition = 'opacity 0.5s';
        toast.innerHTML = 'Mesajınız başarıyla iletildi! <svg viewBox="0 0 24 24" width="18" height="18" stroke="#00a884" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-left: 5px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
        document.body.appendChild(toast);
        
        // Wait 2 seconds, fade out toast, and close modal
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                toast.remove();
                document.getElementById('messageModal').classList.add('hidden');
                msgInput.value = "";
                msgInput.style.height = '';
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.style.opacity = '1';
                }
                if (chatBody) {
                    const sentBubbles = chatBody.querySelectorAll('.wa-sent');
                    sentBubbles.forEach(b => b.remove());
                }
            }, 500);
        }, 2000);
        
    } catch (e) {
        console.error(e);
        alert("Mesaj gönderilirken hata oluştu. Lütfen tekrar deneyin.");
    }
};



document.addEventListener('DOMContentLoaded', () => {
    // Bypass HTML caching
    const adminBtn = document.querySelector('.admin-login-corner');
    if (adminBtn) adminBtn.remove();
    
    const closeSysBtn = document.querySelector('button[onclick="window.closeSystem()"]');
    if (closeSysBtn && closeSysBtn.parentElement) {
        closeSysBtn.style.background = '#e53e3e';
        closeSysBtn.style.color = 'white';
        closeSysBtn.parentElement.prepend(closeSysBtn);
    }
});
    const faultBoardClose = document.querySelector('#faultBoardModal button');
    if (faultBoardClose) {
        faultBoardClose.style.color = '#e53e3e';
        faultBoardClose.style.fontWeight = 'bold';
        if (!faultBoardClose.innerHTML.includes('Kapat')) {
            faultBoardClose.innerHTML = '&times; Kapat';
        }
    }
    // Force remove the bottom power button if cached HTML is loading
    const bottomPower = document.querySelector('.bottom-power-wrapper');
    if (bottomPower) bottomPower.remove();
    const btnPower = document.querySelector('.btn-power');
    if (btnPower) btnPower.remove();
    const topMenu = document.querySelector('.glass-top-menu');
    if (topMenu) {
        const hasKapat = topMenu.querySelector('button[title="Kapat"]') !== null;
        if (!hasKapat) {
            const topMenuBtn = document.createElement('button');
            topMenuBtn.className = 'glass-icon-btn';
            topMenuBtn.title = 'Kapat';
            topMenuBtn.style.background = '#e53e3e'; topMenuBtn.style.color = 'white'; topMenuBtn.style.borderRadius = '50%'; topMenuBtn.style.width = '40px'; topMenuBtn.style.height = '40px'; topMenuBtn.style.display = 'flex'; topMenuBtn.style.flexDirection = 'column'; topMenuBtn.style.justifyContent = 'center'; topMenuBtn.style.alignItems = 'center'; topMenuBtn.style.boxShadow = '0 4px 10px rgba(229, 62, 62, 0.4)';
            topMenuBtn.onclick = () => window.resetStepper();
            topMenuBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>';
            topMenu.appendChild(topMenuBtn);
        }
    }
    // Force Kapat text removal
    const kapatBtn = topMenu ? topMenu.querySelector('button[title="Kapat"]') : null;
    if (kapatBtn) {
        const textSpan = kapatBtn.querySelector('.icon-text');
        if (textSpan) textSpan.remove();
        const svg = kapatBtn.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '18');
            svg.setAttribute('height', '18');
        }
    }
