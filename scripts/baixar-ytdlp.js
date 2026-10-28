// =================================================
// ⬇️ BAIXA O yt-dlp DURANTE O npm install (postinstall)
// Assim música e vídeo já funcionam na primeira vez, baixando direto do
// YouTube. NUNCA derruba o install: se falhar, o bot baixa sozinho ao ligar.
// =================================================
const fs = require("fs");
const path = require("path");
const https = require("https");

const DESTINO = path.join(process.cwd(), "yt-dlp");
const URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

function baixar(url, destino, redir = 5) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
                res.resume();
                if (redir <= 0) return reject(new Error("muitos redirecionamentos"));
                return resolve(baixar(res.headers.location, destino, redir - 1));
            }
            if (res.statusCode !== 200) { res.resume(); return reject(new Error("HTTP " + res.statusCode)); }
            const arq = fs.createWriteStream(destino);
            res.pipe(arq);
            arq.on("finish", () => arq.close(() => resolve()));
            arq.on("error", reject);
        });
        req.on("error", reject);
        req.setTimeout(60000, () => req.destroy(new Error("tempo esgotado")));
    });
}

(async () => {
    if (process.platform !== "linux") {
        console.log("ℹ️ yt-dlp: pulado (não é Linux). O bot baixa sozinho quando ligar.");
        return;
    }
    try {
        await baixar(URL, DESTINO);
        try { fs.chmodSync(DESTINO, 0o755); } catch {}
        console.log("✅ yt-dlp baixado em " + DESTINO);
    } catch (e) {
        console.log("⚠️ yt-dlp não baixou agora (" + e.message + "). O bot baixa sozinho quando ligar.");
    }
})();
