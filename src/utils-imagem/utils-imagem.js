/* =================================================
   🖼️ UTILITÁRIOS DE IMAGEM — KATRIELLY
   📁 Arquivo: utils-imagem.js
   Só o que sobrou do antigo sistema de cards: baixar imagem por URL,
   detectar o formato real e carregar imagem com diagnóstico.
================================================= */

const https = require("https");
const { loadImage } = require("@napi-rs/canvas");

function baixarBuffer(url, redirecionamentosRestantes = 3) {
    return new Promise((resolve, reject) => {
        if (!url) return reject(new Error("URL vazia"));
        https.get(url, (res) => {
            // 🔁 CDNs do WhatsApp às vezes redirecionam (301/302/307) — sem isso,
            // a promise rejeitava com um "erro" que na real era só um redirect.
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirecionamentosRestantes > 0) {
                res.resume(); // descarta o corpo da resposta atual
                return resolve(baixarBuffer(res.headers.location, redirecionamentosRestantes - 1));
            }
            if (res.statusCode !== 200) return reject(new Error(`Falha ao baixar imagem: HTTP ${res.statusCode} (${url})`));
            const chunks = [];
            res.on("data", (c) => chunks.push(c));
            res.on("end", () => resolve(Buffer.concat(chunks)));
        }).on("error", (e) => reject(new Error(`Erro de rede ao baixar imagem (${url}): ${e.message}`)));
    });
}

function detectarFormatoImagem(buffer) {
    if (!buffer || buffer.length < 12) return "desconhecido (arquivo vazio ou muito pequeno)";
    const b = buffer;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "PNG";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "JPEG";
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "GIF";
    if (b[0] === 0x42 && b[1] === 0x4d) return "BMP";
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b.length > 11 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "WEBP";
    if (b.length > 12 && b.slice(4, 8).toString("ascii") === "ftyp") {
        const marca = b.slice(8, 12).toString("ascii").toLowerCase();
        if (marca.includes("avif")) return "AVIF";
        if (marca.includes("heic") || marca.includes("heix") || marca.includes("hevc") || marca.includes("mif1")) {
            return "HEIC/HEIF (foto de iPhone sem conversão — normalmente o WhatsApp converte pra JPEG antes de enviar; se chegou assim, esse formato pode não ser suportado)";
        }
    }
    return `desconhecido (primeiros bytes em hex: ${buffer.slice(0, 4).toString("hex")})`;
}

async function carregarImagemComDiagnostico(buffer, label) {
    if (!buffer) {
        console.error(`❌ [${label}] nenhum buffer de imagem foi passado (nulo/indefinido).`);
        return null;
    }
    if (!Buffer.isBuffer(buffer)) {
        try { buffer = Buffer.from(buffer); } catch { /* deixa cair na checagem de baixo */ }
    }
    if (!buffer || !buffer.length) {
        console.error(`❌ [${label}] o buffer da imagem está vazio (0 bytes) — o download ou a leitura do arquivo falhou antes de chegar aqui.`);
        return null;
    }

    const formato = detectarFormatoImagem(buffer);
    const tentativas = [
        () => loadImage(buffer),
        () => loadImage(new Uint8Array(buffer)),
        () => loadImage(Buffer.from(buffer)), // cópia nova do buffer, evita buffers "compartilhados"/views estranhas
    ];

    let ultimoErro = null;
    for (const tentativa of tentativas) {
        try {
            return await tentativa();
        } catch (e) {
            ultimoErro = e;
        }
    }

    console.error(
        `❌ [${label}] não consegui carregar a imagem em NENHUMA tentativa.\n` +
        `   📦 Tamanho do arquivo: ${buffer.length} bytes\n` +
        `   🔍 Formato real detectado pelos bytes (não pela extensão): ${formato}\n` +
        `   ⚠️ Último erro: ${ultimoErro?.message}\n` +
        `   💡 Se o formato acima não for PNG/JPEG/WEBP/GIF/BMP, esse é o motivo — ` +
        `reenvie a imagem original (sem editar/renomear) ou converta pra JPEG antes de salvar.`
    );
    return null;
}

module.exports = { baixarBuffer, detectarFormatoImagem, carregarImagemComDiagnostico };
