const fs = require('fs');
let appJs = fs.readFileSync('app.js', 'utf8');

// 1. In goToStep, trigger step6 animation
const goToStepRegex = /currentActiveCard\.classList\.remove\('active'\);\s*if\(currentActiveNav\) currentActiveNav\.classList\.remove\('active'\);\s*}\s*const targetCard = document\.getElementById\('step' \+ step\);/g;
appJs = appJs.replace(goToStepRegex, `currentActiveCard.classList.remove('active');
        if(currentActiveNav) currentActiveNav.classList.remove('active');
    }
    
    if (step === 6) {
        if (window.startStep6Chat) window.startStep6Chat();
    }
    
    const targetCard = document.getElementById('step' + step);`);

// 2. In window.nextStep, remove showSummaryOverlay
const nextStepRegex = /if \(currentStepNum === 6\) \{[\s\S]*?\} else \{[\s\S]*?goToStep\(currentStepNum \+ 1\);[\s\S]*?\}/;
appJs = appJs.replace(nextStepRegex, `goToStep(currentStepNum + 1);`);

// 3. Remove showSummaryOverlay and everything around it, up to submit event
const summaryRegex = /window\.showSummaryOverlay = \(\) => \{[\s\S]*?form\.addEventListener\('submit', async \(e\) => \{/;
appJs = appJs.replace(summaryRegex, `window.submitStep6 = async () => {
    const sendBtn = document.getElementById('btnStep6Send');
    if (sendBtn && sendBtn.disabled) return;
    
    const msgInput = document.getElementById('description');
    const msg = msgInput.value.trim();
    if (msg.length < 5) {
        alert("Lütfen sorunu detaylıca açıklayın (en az 5 harf).");
        return;
    }
    
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
    }
    
    const chatBody = document.getElementById('step6ChatBody');
    if (chatBody) {
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const bubbleHtml = \`
            <div class="wa-message wa-sent">
                <div class="wa-message-text">\${msg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
                <div class="wa-message-time">\${timeStr} <svg class="wa-tick" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:-2px;"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
            </div>
        \`;
        chatBody.insertAdjacentHTML('beforeend', bubbleHtml);
        chatBody.scrollTop = chatBody.scrollHeight;
    }
    
    const e = { preventDefault: () => {} };
    // DO NOT change to form.addEventListener anymore, we are executing submit logic directly here
`);

// 4. Close the submit function at the end where `});` was, and add startStep6Chat
// The old submit function ended around line 684. I need to find `        }, 2000);` and `    } catch (err) {` and `    }` etc.
// Let's replace the end of the submit handler:
const submitEndRegex = /loadingState\.classList\.add\('hidden'\);\s*successState\.classList\.remove\('hidden'\);\s*setTimeout\(\(\) => \{[\s\S]*?window\.resetStepper\(\);[\s\S]*?\}, 2000\);[\s\S]*?\} catch \(err\) \{[\s\S]*?console\.error\("Kayıt başarısız:", err\);[\s\S]*?loadingSubText\.innerText = "Kayıt başarısız oldu!";[\s\S]*?\}\s*\};/g;

// Actually the old function was `form.addEventListener('submit', async (e) => { ... });`
// Since I replaced the top with `window.submitStep6 = async () => { ... const e = { preventDefault: () => {} };`
// Now I need to fix the end of the submit logic. Let's just do a specific replace.
// We'll replace the loading/success modal UI with the chat bubble UI.
const loadingSuccessRegex = /submissionModal\.classList\.remove\('hidden'\);[\s\S]*?loadingSubText\.innerText = "Kayıt Oluşturuluyor\.\.\.";/g;
appJs = appJs.replace(loadingSuccessRegex, `// Yükleniyor falan yok, arka planda hallet
    let photoUrl = "";
    const cameraFile = document.getElementById('cameraInput') ? document.getElementById('cameraInput').files[0] : null;
    const folderFile = document.getElementById('fileInput') ? document.getElementById('fileInput').files[0] : null;
    const photoFile = cameraFile || folderFile;
    if (photoFile) {
        const compressedBlob = await compressImage(photoFile);
        const storageRef = storage.ref('ariza_fotolari/' + Date.now() + '.jpg');
        await storageRef.put(compressedBlob);
        photoUrl = await storageRef.getDownloadURL();
    }
`);

const endSubmitRegex = /loadingState\.classList\.add\('hidden'\);\s*successState\.classList\.remove\('hidden'\);\s*setTimeout\(\(\) => \{\s*submissionModal\.classList\.add\('hidden'\);\s*window\.resetStepper\(\);\s*\}, 2000\);\s*\} catch \(err\) \{\s*console\.error\("Kayıt başarısız:", err\);\s*loadingSubText\.innerText = "Kayıt başarısız oldu!";\s*\}\s*\};/g;
appJs = appJs.replace(endSubmitRegex, `
        if (chatBody) {
            const typingId = 'typing-reply';
            chatBody.insertAdjacentHTML('beforeend', \`
                <div class="wa-message wa-received" id="\${typingId}">
                    <div class="wa-message-text" style="color:#aaa; font-style:italic; padding: 2px 5px;">Yazıyor...</div>
                </div>
            \`);
            chatBody.scrollTop = chatBody.scrollHeight;
            
            setTimeout(() => {
                document.getElementById(typingId)?.remove();
                chatBody.insertAdjacentHTML('beforeend', \`
                    <div class="wa-message wa-received">
                        <div class="wa-message-text">Teşekkürler, mesajın bakım birimine iletildi.</div>
                        <div class="wa-message-time">\${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                \`);
                chatBody.scrollTop = chatBody.scrollHeight;
                
                setTimeout(() => {
                    window.resetStepper();
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        sendBtn.style.opacity = '1';
                    }
                }, 2000);
            }, 1000);
        }
    } catch (err) {
        console.error("Kayıt başarısız:", err);
        alert("Kayıt sırasında bir hata oluştu.");
        if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
    }
};

window.startStep6Chat = () => {
    const chatBody = document.getElementById('step6ChatBody');
    if (!chatBody) return;
    
    // reset it first
    chatBody.innerHTML = '<div class="wa-date-chip">Bugün</div>';
    
    const showTyping = () => {
        const typingId = 'typing-' + Date.now();
        const html = \`
            <div class="wa-message wa-received" id="\${typingId}">
                <div class="wa-message-text" style="color:#aaa; font-style:italic; padding: 2px 5px;">Yazıyor...</div>
            </div>
        \`;
        chatBody.insertAdjacentHTML('beforeend', html);
        chatBody.scrollTop = chatBody.scrollHeight;
        return typingId;
    };

    const pushMsg = (text) => {
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const html = \`
            <div class="wa-message wa-received">
                <div class="wa-message-text">\${text}</div>
                <div class="wa-message-time">\${timeStr}</div>
            </div>
        \`;
        chatBody.insertAdjacentHTML('beforeend', html);
        chatBody.scrollTop = chatBody.scrollHeight;
    };
    
    let tId = showTyping();
    setTimeout(() => {
        document.getElementById(tId)?.remove();
        pushMsg("Merhaba");
        
        tId = showTyping();
        setTimeout(() => {
            document.getElementById(tId)?.remove();
            pushMsg("Arızaya müdahale edilmedi mi?");
            
            tId = showTyping();
            setTimeout(() => {
                document.getElementById(tId)?.remove();
                pushMsg("İstediğin olmadı mı?");
                
                tId = showTyping();
                setTimeout(() => {
                    document.getElementById(tId)?.remove();
                    pushMsg("Öneri ve şikayetin mi var?");
                    
                    tId = showTyping();
                    setTimeout(() => {
                        document.getElementById(tId)?.remove();
                        pushMsg("Bu konularda bize yazabilirsin.");
                        const msgInput = document.getElementById('description');
                        if (msgInput) msgInput.focus();
                    }, 800);
                }, 800);
            }, 800);
        }, 1200);
    }, 800);
};

`);

// 5. Remove window.sendOpMessage completely
const opMsgRegex = /window\.sendOpMessage = async \(\) => \{[\s\S]*?console\.error\("Mesaj kaydedilemedi:", e\);\s*alert\("Bir hata oluştu, mesaj gönderilemedi\."\);\s*if\(sendBtn\) \{ sendBtn\.disabled = false; sendBtn\.style\.opacity = '1'; \}\s*\}\s*\};/g;
appJs = appJs.replace(opMsgRegex, '');

fs.writeFileSync('app.js', appJs, 'utf8');

