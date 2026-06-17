$appJs = Get-Content app.js -Raw -Encoding UTF8

$goToStepRegex = "(?s)currentActiveCard\.classList\.remove\('active'\);\s*if\(currentActiveNav\) currentActiveNav\.classList\.remove\('active'\);\s*}\s*const targetCard = document\.getElementById\('step' \+ step\);"
$goToStepReplace = @"
currentActiveCard.classList.remove('active');
        if(currentActiveNav) currentActiveNav.classList.remove('active');
    }
    
    if (step === 6) {
        if (window.startStep6Chat) window.startStep6Chat();
    }
    
    const targetCard = document.getElementById('step' + step);
"@
$appJs = [System.Text.RegularExpressions.Regex]::Replace($appJs, $goToStepRegex, $goToStepReplace)

$nextStepRegex = "(?s)if \(currentStepNum === 6\) \{.*?\} else \{.*?goToStep\(currentStepNum \+ 1\);.*?\}"
$appJs = [System.Text.RegularExpressions.Regex]::Replace($appJs, $nextStepRegex, "goToStep(currentStepNum + 1);")

$summaryRegex = "(?s)window\.showSummaryOverlay = \(\) => \{.*?form\.addEventListener\('submit', async \(e\) => \{"
$summaryReplace = @"
window.submitStep6 = async () => {
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
"@
$appJs = [System.Text.RegularExpressions.Regex]::Replace($appJs, $summaryRegex, $summaryReplace)

$loadingSuccessRegex = "(?s)submissionModal\.classList\.remove\('hidden'\);.*?loadingSubText\.innerText = `"Kay\p{L}t Olu\p{L}turuluyor\.\.\.`";"
$loadingSuccessReplace = @"
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
"@
$appJs = [System.Text.RegularExpressions.Regex]::Replace($appJs, $loadingSuccessRegex, $loadingSuccessReplace)

$endSubmitRegex = "(?s)loadingState\.classList\.add\('hidden'\);\s*successState\.classList\.remove\('hidden'\);\s*setTimeout\(\(\) => \{\s*submissionModal\.classList\.add\('hidden'\);\s*window\.resetStepper\(\);\s*\}, 2000\);\s*\} catch \(err\) \{\s*console\.error\(`"Kay\p{L}t ba\p{L}ar\p{L}s\p{L}z:`", err\);\s*loadingSubText\.innerText = `"Kay\p{L}t ba\p{L}ar\p{L}s\p{L}z oldu!`";\s*\}\s*\};"
$endSubmitReplace = @"
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
"@
$appJs = [System.Text.RegularExpressions.Regex]::Replace($appJs, $endSubmitRegex, $endSubmitReplace)

$opMsgRegex = "(?s)window\.sendOpMessage = async \(\) => \{.*?console\.error\(`"Mesaj kaydedilemedi:`", e\);\s*alert\(`"Bir hata olu\p{L}tu, mesaj g\p{L}nderilemedi\.`"\);\s*if\(sendBtn\) \{ sendBtn\.disabled = false; sendBtn\.style\.opacity = '1'; \}\s*\}\s*\};"
$appJs = [System.Text.RegularExpressions.Regex]::Replace($appJs, $opMsgRegex, "")

$appJs | Set-Content app.js -Encoding UTF8
