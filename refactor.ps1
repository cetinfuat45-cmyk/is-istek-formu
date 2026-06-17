$html = Get-Content index.html -Raw -Encoding UTF8

# Replace Step 6
$newStep6 = @"
<div class="card-step" id="step6">
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
        </form>
"@
$html = [System.Text.RegularExpressions.Regex]::Replace($html, '(?s)<div class="card-step" id="step6">.*?</div>\s*</form>', $newStep6)

# Remove Summary Overlay
$html = [System.Text.RegularExpressions.Regex]::Replace($html, '(?s)<!-- Summary Overlay -->.*?<!-- Arıza Panosu Modalı -->', '<!-- Arıza Panosu Modalı -->')

# Remove Message Modal (both variations)
$html = [System.Text.RegularExpressions.Regex]::Replace($html, '(?si)<!-- Message Modal -->.*?</div>\s*</div>\s*<script', '<script')
$html = [System.Text.RegularExpressions.Regex]::Replace($html, '(?si)<!-- Mesaj Modalı -->.*?</div>\s*</div>\s*<script', '<script')

# Remove old message modal if exists
$html = [System.Text.RegularExpressions.Regex]::Replace($html, '(?si)<div id="messageModal" class="modal-overlay hidden">.*?</div>\s*</div>\s*<script', '<script')

# Bump version
$html = [System.Text.RegularExpressions.Regex]::Replace($html, 'v=50\.\d+', 'v=50.26')

$html | Set-Content index.html -Encoding UTF8
