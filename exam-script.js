// ================================================================
// LIFEINVADER EXAM SYSTEM - CANDIDATE SIDE (THE BRAIN)
// ================================================================

let examData = null;
let allQuestionsData = [];
let timerInterval;
let timeLeft = 15 * 60; 
let token = "";

// İngiltere saatini alma fonksiyonu
function getUKTime(dateObj = new Date()) {
    return dateObj.toLocaleString('en-GB', { timeZone: 'Europe/London' });
}

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');

    if (!token) { disableStart("❌ Invalid Link!"); return; }
    
    // KONTROL 1: Daha önce "Start"a basıldı mı?
    if (localStorage.getItem('used_' + token)) { 
        disableStart("⚠️ This exam has already been taken!"); 
        return; 
    }

    try {
        const jsonString = decodeURIComponent(escape(atob(token)));
        examData = JSON.parse(jsonString);

        // KONTROL 2: Link oluşturulalı 15 dakika geçti mi?
        const diffMinutes = (new Date().getTime() - examData.time) / 1000 / 60;
        
        if (diffMinutes > 15) { 
            disableStart("⚠️ This link has expired! (15 min limit passed)"); 
            return; 
        }

        // Giriş Ekranı Bilgilendirme Metni
        const introHTML = `
        <div style="text-align: left; color: #e9ecef; font-size: 14px; line-height: 1.6;">
            <p style="margin-bottom: 15px;">Hello <strong style="color: #00d9ff;">${examData.title} ${examData.candidate}</strong>,</p>
            <p style="margin-bottom: 15px;">My Name Is <strong style="color: #e94560;">${examData.admin}</strong> and I will give to you LifeInvader <strong>(Test 1)</strong>.</p>
            <ul style="padding-left: 25px; margin: 15px 0; line-height: 1.8;">
                <li>You will have <strong style="color: #ffc107;">15 minutes</strong> to edit 7 ADs.</li>
                <li>You need a minimum of <strong style="color: #00d9ff;">5 correct answers to pass</strong> the test.</li>
                <li>If the ad text is <strong style="color: #28a745;">correct</strong>, you can leave the text box <strong>EMPTY</strong>.</li>
                <li>Some ADs may need <strong style="color: #dc3545;">Rejecting</strong> - keep an eye out!</li>
                <li>At the end of each AD, please mention the <strong style="color: #ffc107;">Category</strong> in brackets.</li>
                <li style="margin-top: 10px;">All the best! 🍀</li>
            </ul>
        </div>`;
        document.getElementById('intro-text').innerHTML = introHTML;

    } catch (e) {
        console.error(e);
        disableStart("❌ Corrupted Link!");
    }
};

function disableStart(msg) {
    const warning = document.getElementById('expiry-warning');
    warning.innerText = msg;
    warning.style.display = 'block';
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-start').innerText = "ACCESS DENIED";
    document.getElementById('btn-start').classList.replace('btn-success', 'btn-secondary');
}

function startExam() {
    // Linki kilitle (Tek kullanımlık yap)
    localStorage.setItem('used_' + token, 'true');
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('exam-container').style.display = 'block';
    loadQuestions();
    timerInterval = setInterval(updateTimer, 1000);
}

function loadQuestions() {
    // Admin panelden gelen soruları yükle
    allQuestionsData = examData.questions;
    const container = document.getElementById('questions-area');
    let htmlContent = "";
    
    examData.questions.forEach((item, i) => {
        htmlContent += `
        <div class="question-block">
            <label class="fw-bold mb-3" style="color: #ffc107; font-size: 16px;">Question ${i+1}:</label>
            <p class="text-white mb-3" style="font-family:'Courier New'; font-size: 14px; line-height: 1.6;">${item.q}</p>
            
            <div class="row g-3">
                <div class="col-md-8">
                    <textarea id="answer-text-${i}" class="form-control answer-input" rows="3" placeholder="Ad Text (Leave empty if correct)"></textarea>
                </div>
                <div class="col-md-4">
                    <input type="text" id="answer-cat-${i}" class="form-control cat-input" placeholder="Category">
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = htmlContent;
}

function updateTimer() {
    const timerBox = document.getElementById('timer-box');
    let m = Math.floor(timeLeft / 60);
    let s = timeLeft % 60;
    
    if (timeLeft < 60) {
        timerBox.classList.add("time-warning"); // Son dakika uyarısı
    }

    timerBox.innerText = `${m}:${s < 10 ? '0'+s : s}`;
    
    if (timeLeft <= 0) {
        clearInterval(timerInterval);
        finishExam(); 
    } else {
        timeLeft--;
    }
}

// --- MANTIK VE KONTROL MERKEZİ ---

// 1. Cevap Ayrıştırma (Metin ve Kategori ayırır)
function parseAnswerString(fullStr) {
    const lastParen = fullStr.lastIndexOf('(');
    if (lastParen > -1) {
        return {
            text: fullStr.substring(0, lastParen).trim(),
            cat: fullStr.substring(lastParen).replace(/[()]/g, '').trim()
        };
    }
    return { text: fullStr.trim(), cat: "" };
}

// 2. Kategori Temizleyici (Basit hata toleransı)
function cleanCategory(str) {
    if (!str) return "";
    return str.replace(/[()]/g, '').replace(/[^a-zA-Z]/g, '').toLowerCase();
}

// 3. NUCLEAR STRIP: İşte senin istediğin SÜPER KONTROL fonksiyonu
// Noktalama işaretlerini, bağlaçları ve gereksiz kelimeleri siler.
function nuclearStrip(text) {
    if (!text) return "";
    return text.toLowerCase()
        // Yazım hataları düzeltmeleri
        .replace(/can\s*not/g, "cannot") 
        .replace(/look\s*ing/g, "looking") 
        
        // Gereksiz dolgu kelimeleri ve sembolleri sil
        .replace(/\b(rejected|reject|reason|blacklisted|blacklist|and|or|the|a|an)\b/g, "")
        
        // Sadece harf ve rakam bırak (Nokta, virgül, tire hepsi gider)
        .replace(/[^a-z0-9]/g, "");
}

// 4. Eşleştirme Motoru
function checkAnswerMatch(userAnswer, correctAnswer) {
    let u = userAnswer.toLowerCase();
    let c = correctAnswer.toLowerCase();

    // Eğer cevap "Rejected" içeriyorsa Nuclear Strip kullan
    if (c.startsWith("reject")) {
        const uClean = nuclearStrip(u);
        const cClean = nuclearStrip(c);
        
        // Eğer öğrenci boş bıraktıysa ama reddetmesi gerekiyorsa -> Yanlış
        if (uClean.length < 3) return false; 

        return uClean === cClean;
    } 
    // Normal sorular için birebir kontrol (Ama boşlukları ve noktaları yine esnetebiliriz)
    else {
        // Normal sorularda da basit temizlik yapalım
        return u.replace(/[^a-z0-9]/g, "") === c.replace(/[^a-z0-9]/g, "");
    }
}

function finishExam() {
    clearInterval(timerInterval);
    document.getElementById('exam-container').style.display = 'none';
    
    let correctCount = 0;
    let resultListHTML = "";
    
    examData.questions.forEach((item, i) => {
        const userAdText = document.getElementById(`answer-text-${i}`).value.trim();
        const userCatText = document.getElementById(`answer-cat-${i}`).value.trim();
        
        // JSON'daki "OR" ile ayrılmış cevapları böl
        const possibleAnswersRaw = item.a.split(" or ");
        
        let isQuestionPassed = false;
        let finalCorrectObj = null; 

        // --- DÖNGÜ: Öğrencinin cevabını tüm ihtimallerle kıyasla ---
        for (let rawOption of possibleAnswersRaw) {
            const correctObj = parseAnswerString(rawOption);
            finalCorrectObj = correctObj; // Rapor için sonuncuyu tut

            // ADIM 1: METİN KONTROLÜ (Nuclear Logic burada devreye giriyor)
            let isTextMatch = checkAnswerMatch(userAdText, correctObj.text);

            // Eğer öğrenci doğruysa ve metin kutusunu BOŞ bıraktıysa (Doğru kabul etme kuralı)
            if (userAdText === "" && !correctObj.text.toLowerCase().startsWith("reject")) {
                 // Metin zaten doğruysa ve öğrenci ellemediyse -> DOĞRU sayıyoruz.
                 // Ancak senin sisteminde öğrenci "Correct" olanı boş mu bırakıyor yoksa aynısını mı yazıyor?
                 // Kural: "If the ad text is correct, you can leave the text box EMPTY."
                 // Bu yüzden eğer orijinal soru metni ile cevap metni aynıysa ve input boşsa -> Doğru
                 if (item.q.includes(correctObj.text)) isTextMatch = true; // Basit mantık
            }

            // ADIM 2: KATEGORİ KONTROLÜ
            const uCat = cleanCategory(userCatText);
            const cCat = cleanCategory(correctObj.cat);
            let isCatMatch = (uCat === cCat);

            // Rejected sorularında kategori bazen boş bırakılabilir veya "Rejected" yazılabilir
            if (correctObj.text.toLowerCase().startsWith("reject") && (uCat === "" || uCat === "rejected")) {
                isCatMatch = true;
            }

            if (isTextMatch && isCatMatch) {
                isQuestionPassed = true;
                break; // Eşleşme bulundu, diğer varyasyonlara bakmaya gerek yok
            }
        }

        if (isQuestionPassed) correctCount++;
        
        // --- RAPORLAMA ---
        let adTextDisplay = isQuestionPassed 
            ? `<span style="color:green; font-weight:bold;">${userAdText || "(Correct / Empty)"}</span>`
            : `<span style="color:red; text-decoration:line-through;">${userAdText || "(Empty)"}</span> <br><span style="color:green; font-size:10px;">Expected: ${possibleAnswersRaw[0]}</span>`;

        let catDisplay = isQuestionPassed
            ? `<span style="color:green; font-weight:bold;">${userCatText || "(Correct)"}</span>`
            : `<span style="color:red; text-decoration:line-through;">${userCatText || "(Empty)"}</span>`;

        resultListHTML += `
        <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:8px;">
            <div style="font-weight:bold; font-size:12px; color:#333;">
                Q${i+1}: ${isQuestionPassed ? '✅' : '❌'}
            </div>
            <div style="font-size:11px; margin-left:20px; margin-top:3px;">
                <strong>Input:</strong> ${adTextDisplay}<br>
                <strong>Cat:</strong> ${catDisplay}
            </div>
        </div>`;
    });

    // --- SONUÇ EKRANI VE PDF ---
    const isPassed = correctCount >= 5;
    const now = new Date();
    const examDateStr = now.toLocaleString('en-GB', { timeZone: 'Europe/London' });
    
    // Retest Zamanı Hesaplama (+4 Saat)
    const retestDate = new Date(now.getTime() + 4*60*60*1000);
    const formattedDate = `${String(retestDate.getDate()).padStart(2, '0')}.${String(retestDate.getMonth() + 1).padStart(2, '0')}.${retestDate.getFullYear()}`;
    const formattedTime = `${String(retestDate.getHours()).padStart(2, '0')}:${String(retestDate.getMinutes()).padStart(2, '0')}`;

    let resultMessage = isPassed 
        ? `<h3 style="color:green;">Passed ✅ (${correctCount}/7)</h3><p>Welcome to LifeInvader!</p>`
        : `<h3 style="color:red;">Failed ❌ (${correctCount}/7)</h3><p>Retest: ${formattedDate} at ${formattedTime}</p>`;

    const reportHTML = `
    <div id="final-report-view" style="font-family: Arial; padding: 40px; width: 100%; max-width: 800px; margin: 0 auto;">
        <div style="text-align:center; border-bottom: 2px solid #e94560; padding-bottom: 10px;">
            <h2 style="color: #e94560;">LifeInvader Exam Result</h2>
        </div>
        <table style="width:100%; margin: 20px 0; font-size:12px;">
            <tr><td><strong>Admin:</strong> ${examData.admin}</td><td style="text-align:right;">${examDateStr}</td></tr>
            <tr><td><strong>Candidate:</strong> ${examData.title} ${examData.candidate}</td><td style="text-align:right;"><strong>${isPassed ? "PASSED" : "FAIL"}</strong></td></tr>
        </table>
        <div style="background:#f8f9fa; padding:15px; border:1px solid #ddd;">
            ${resultListHTML}
        </div>
        <div style="text-align:center; margin-top:20px;">
            ${resultMessage}
        </div>
        <div style="text-align:center; margin-top:30px; font-size:10px; color:gray;">OFFICIAL LIFEINVADER DOCUMENT</div>
    </div>`;

    document.body.innerHTML = reportHTML;
    document.body.style.background = "white"; 

    // PDF İndirme (html2pdf kütüphanesi HTML'de ekli olmalı)
    setTimeout(() => {
        const element = document.getElementById('final-report-view');
        html2pdf().from(element).save(`Result_${examData.candidate.replace(/\s/g, '_')}.pdf`);
    }, 1000);
}
