// Yetki Kontrolü
if (sessionStorage.getItem('isAdmin') !== 'true') {
    alert("Bu sayfaya erişim yetkiniz yok. Lütfen giriş yapın.");
    window.location.href = 'dashboard.html';
}

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
const settingsRef = db.collection('ayarlar');

const categories = [];

// Son Senkronizasyon Zamanını Çek
settingsRef.doc('lastSync').onSnapshot(doc => {
    const el = document.getElementById('lastSyncTime');
    if (el) {
        if (doc.exists && doc.data().timestamp) {
            const date = doc.data().timestamp.toDate();
            el.innerHTML = `✅ Son Güncelleme: ${date.toLocaleString('tr-TR')}`;
        } else {
            el.innerHTML = `Son Güncelleme: Veri yok.`;
        }
    }
});

// Verileri Canlı Çek ve Ekrana Bas
categories.forEach(cat => {
    settingsRef.doc(cat).onSnapshot(doc => {
        const container = document.getElementById(`list-${cat}`);
        if (!doc.exists) { container.innerHTML = "<div class='list-item'>Liste boş</div>"; return; }
        
        const list = doc.data().list || [];
        if (list.length === 0) { container.innerHTML = "<div class='list-item'>Liste boş</div>"; return; }

        let html = "";
        list.sort().forEach(item => {
            const safeItem = item.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `
                <div class="list-item">
                    <span>${item}</span>
                    <button class="btn-delete" onclick="removeItem('${cat}', '${safeItem}')">Sil</button>
                </div>
            `;
        });
        container.innerHTML = html;
    });
});

// Standart Liste Elemanı Ekleme
window.addItem = async (cat) => {
    const inputEl = document.getElementById(`input-${cat}`);
    const value = inputEl.value.trim().toUpperCase();
    if (!value) return;
    try {
        await settingsRef.doc(cat).set({ list: firebase.firestore.FieldValue.arrayUnion(value) }, { merge: true });
        inputEl.value = "";
    } catch (err) { alert("Eklenirken hata oluştu."); }
};

// Standart Liste Elemanı Silme
let pendingDelete = null;

window.removeItem = (cat, item) => {
    pendingDelete = { cat, item };
    document.getElementById('confirmModalText').innerText = `"${item}" kaydını silmek istediğinize emin misiniz?`;
    document.getElementById('confirmModal').classList.remove('hidden');
};

document.getElementById('confirmBtnYes').addEventListener('click', async () => {
    if (!pendingDelete) return;
    const { cat, item } = pendingDelete;
    document.getElementById('confirmModal').classList.add('hidden');
    
    try {
        await settingsRef.doc(cat).update({ list: firebase.firestore.FieldValue.arrayRemove(item) });
    } catch (err) { alert("Silinirken hata oluştu."); }
    pendingDelete = null;
});

// Google Sheets Toplu Veri Çekme
window.fetchGoogleSheet = async () => {
    const btn = document.getElementById('syncBtn');
    if (!confirm("Google Sheets'teki veriler okunarak sisteme eklenecektir. Onaylıyor musunuz?")) return;
    
    btn.disabled = true;
    btn.innerHTML = "⏳ Tablolara Bağlanıyor...";

    try {
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
                        
                        // Eşleştirmeyi kaydet
                        if (!machineMap[dept]) machineMap[dept] = new Set();
                        machineMap[dept].add(mach);
                    }
                }
            }
        }

        btn.innerHTML = "⏳ Veritabanı Güncelleniyor...";

        const deptArray = Array.from(departments);
        const machArray = Array.from(machines);

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

        const finalMap = {};
        Object.keys(machineMap).forEach(k => {
            finalMap[k] = Array.from(machineMap[k]);
        });

        // Firebase'e Kaydet (Üzerine yazar)
        if (deptArray.length > 0) {
            await settingsRef.doc('departments').set({ list: deptArray });
        }
        if (machArray.length > 0) {
            await settingsRef.doc('machines').set({ list: machArray });
        }
        if (Object.keys(finalMap).length > 0) {
            await settingsRef.doc('machineMap').set(finalMap);
        }
        if (jobTypeArray.length > 0) {
            await settingsRef.doc('jobTypes').set({ list: jobTypeArray });
        }
        if (shiftArray.length > 0) {
            await settingsRef.doc('shifts').set({ list: shiftArray });
        }

        // YENİ: Son Güncelleme Tarihini Kaydet
        await settingsRef.doc('lastSync').set({ 
            date: new Date().toLocaleDateString('tr-TR'), 
            timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });

        alert(`✅ Başarılı!\nTablolarınızdan:\n- ${deptArray.length} Bölüm\n- ${machArray.length} Makine\n- ${jobTypeArray.length} İş Türü\n- ${shiftArray.length} Vardiya çekildi ve güncellendi.`);
        
    } catch (err) {
        console.error(err);
        alert("Bir hata oluştu: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "📥 Tablodan Makine ve Bölümleri Çek";
    }
};

// Mail Ayarlarını Çek
settingsRef.doc('adminEmail').onSnapshot(doc => {
    if (doc.exists) {
        document.getElementById('input-adminEmail').value = doc.data().key || "";
        document.getElementById('input-targetEmail').value = doc.data().targetEmail || "";
        
        // Şalterleri güncelle (Eğer ayar yoksa varsayılan olarak açık kabul et)
        document.getElementById('toggle-loginMailEnabled').checked = doc.data().loginMailEnabled !== false;
        document.getElementById('toggle-faultMailEnabled').checked = doc.data().faultMailEnabled !== false;
    } else {
        document.getElementById('toggle-loginMailEnabled').checked = true;
        document.getElementById('toggle-faultMailEnabled').checked = true;
    }
});

// Access Key veya Google Apps Script Linki Kaydet
window.saveAdminEmail = async () => {
    const key = document.getElementById('input-adminEmail').value.trim();
    const targetEmail = document.getElementById('input-targetEmail').value.trim();
    
    if(key.includes('@')) {
        alert("HATA: İlk kutuya şifreyi (Access Key) veya Google Apps Script Linkini yazmalısınız. E-Posta adresinizi 2. kutuya yazın.");
        return;
    }
    if(!key || (key.length < 25 && !key.startsWith('http'))) {
        alert("HATA: Girdiğiniz Web3Forms/Google kodu geçersiz. Lütfen eksiksiz kopyalayın.");
        return;
    }
    
    try {
        await settingsRef.doc('adminEmail').set({ key: key, targetEmail: targetEmail }, { merge: true });
        alert("✅ E-Posta Gönderim Bilgisi başarıyla kaydedildi! (Not: Google Apps Script kullanıyorsanız sağdaki 'Test Et' butonu sadece Web3Forms için çalışır, dikkate almayınız).");
        document.getElementById('testBtn').style.display = 'block';
    } catch (err) { alert("Kaydedilirken hata oluştu."); }
};

// Şalterleri (Aç/Kapat) Veritabanına Kaydet
window.toggleMailSetting = async (settingName) => {
    const isChecked = document.getElementById(`toggle-${settingName}`).checked;
    try {
        await settingsRef.doc('adminEmail').set({ [settingName]: isChecked }, { merge: true });
    } catch(e) {
        alert("Ayar değiştirilemedi.");
    }
};

window.testEmail = async () => {
    const key = document.getElementById('input-adminEmail').value.trim();
    if(!key) return;
    
    const btn = document.getElementById('testBtn');
    btn.innerText = "Gönderiliyor...";
    btn.disabled = true;
    
    try {
        if (key.startsWith("http")) {
            const targetEmail = document.getElementById('input-targetEmail').value.trim();
            // Google Apps Script Testi
            fetch(key, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    type: 'fault',
                    targetEmail: targetEmail,
                    subject: "✅ SİSTEM TESTİ BAŞARILI (Google Apps Script)",
                    from_name: "Bakım Sistemi Test",
                    description: `Tebrikler! Google sunucunuz üzerinden E-Posta gönderimi kusursuz çalışıyor.\nTarih: ${new Date().toLocaleString('tr-TR')}`,
                    userName: "Test Kullanıcısı",
                    shift: "Test Vardiyası",
                    link: "#"
                })
            }).catch(e => console.log(e));
            
            setTimeout(() => {
                alert("Test maili Google sunucunuza iletildi. Lütfen gelen kutunuzu (Spam klasörü dahil) kontrol ediniz.");
                btn.innerText = "Test Et";
                btn.disabled = false;
            }, 1500);
            
        } else {
            // Web3Forms Testi
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    access_key: key,
                    subject: "✅ SİSTEM TESTİ BAŞARILI",
                    from_name: "Bakım Sistemi Test",
                    email: "test@sistem.com",
                    message: `Tebrikler! Web3Forms API bağlantınız kusursuz çalışıyor.\nTarih: ${new Date().toLocaleString('tr-TR')}`
                })
            });
            const result = await response.json();
            if(result.success) {
                alert("Test maili başarıyla gönderildi! Lütfen posta kutunuzu (ve gereksiz/spam klasörünü) kontrol edin.");
            } else {
                alert("❌ Hata: " + result.message);
            }
            btn.innerText = "Test Et";
            btn.disabled = false;
        }
    } catch (err) {
        alert("Bağlantı hatası oluştu.");
        btn.innerText = "Test Et";
        btn.disabled = false;
    }
};



