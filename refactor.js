const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Replace Step 6
const step6Regex = /<div class="card-step" id="step6">[\s\S]*?<\/div>\s*<\/form>/;
const newStep6 = `<div class="card-step" id="step6">
                <!-- Chat Body inside Step 6 -->
                <div class="wa-chat-body" id="step6ChatBody" style="height: 400px; border-radius: 12px; margin-bottom: 1rem; border: 1px solid #e0e0e0; background: #efeae2; overflow-y: auto; padding: 1rem;">
                    <!-- Date chip added dynamically by JS -->
                </div>
                <!-- Input Area -->
                <div class="wa-input-area" style="padding: 0;">
                    <div class="wa-input-wrapper">
                        <textarea id="description" class="wa-input" placeholder="Açıklama veya mesajınız..." rows="1" oninput="this.style.height = '';this.style.height = this.scrollHeight + 'px'" required></textarea>
                    </div>
                    <button type="button" class="wa-send-btn" id="btnStep6Send" onclick="submitStep6()">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        </form>`;
html = html.replace(step6Regex, newStep6);

// Remove Summary Overlay
const summaryRegex = /<!-- Summary Overlay -->[\s\S]*?<!-- Arıza Panosu Modalı -->/;
html = html.replace(summaryRegex, '<!-- Arıza Panosu Modalı -->');

// Remove Message Modal - It might be "Mesaj Modalı" or "Message Modal"
const msgModalRegex1 = /<!-- Message Modal -->[\s\S]*?<\/div>\s*<\/div>\s*<script/i;
const msgModalRegex2 = /<!-- Mesaj Modalı -->[\s\S]*?<\/div>\s*<\/div>\s*<script/i;
html = html.replace(msgModalRegex1, '<script').replace(msgModalRegex2, '<script');

// Remove original old simple message modal if it's there
const oldMsgModalRegex = /<div id="messageModal" class="modal-overlay hidden">[\s\S]*?<\/div>\s*<\/div>\s*<script/i;
html = html.replace(oldMsgModalRegex, '<script');

// Bump version
html = html.replace(/v=50\.\d+/, 'v=50.26');

fs.writeFileSync('index.html', html, 'utf8');
