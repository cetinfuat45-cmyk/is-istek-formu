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
                const dashboardLink = window.location.href.replace('index.html', '') + 'dashboard.html';
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
    const targetNav = document.getElementById(`nav-step${step}`);
    
    if(targetCard && targetNav) {
        targetCard.classList.add('active');
        targetNav.classList.add('active');
        
        // Eğer mobilde veya dar ekrandaysa menüyü kaydır
        targetNav.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        
        const firstInput = targetCard.querySelector('input, select, textarea');
        if(firstInput) setTimeout(() => firstInput.focus(), 300);
    }
};

window.nextStep = (currentStepNum) => {
    if (validateStep(currentStepNum)) goToStep(currentStepNum + 1);
};

const validateStep = (step) => {
    const container = document.getElementById(`step${step}`);
    if (!container) return true;
    
    const inputs = container.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(el => {
        if (!el.value.trim()) {
            el.style.borderColor = 'var(--danger)';
            el.classList.add('shake');
            setTimeout(() => el.classList.remove('shake'), 500);
            isValid = false;
        } else {
            el.style.borderColor = ''; 
        }
    });
    return isValid;
};

// Form submit başarılı olduğunda veya güç butonuna basıldığında ilk adıma döndür
window.resetStepper = () => {
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

