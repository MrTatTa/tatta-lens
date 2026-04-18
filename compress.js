const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const inputRoot = "assets/full";
const outputRoot = "assets/thumb";
const jsonPath = "gallery.json";

// helper hash
function getFileHash(buffer) {
    return crypto.createHash("md5").update(buffer).digest("hex");
}

// load JSON lama
let galleryData = {};
if (fs.existsSync(jsonPath)) {
    galleryData = JSON.parse(fs.readFileSync(jsonPath));
}

// simpan hash yang sudah ada
let existingHashes = new Set();

// scan semua gambar di thumb buat hash
function scanExistingHashes() {
    if (!fs.existsSync(outputRoot)) return;

    const walk = (dir) => {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            } else {
                const buffer = fs.readFileSync(fullPath);
                const hash = getFileHash(buffer);
                existingHashes.add(hash);
            }
        });
    };

    walk(outputRoot);
}

scanExistingHashes();

// ambil kategori
const categories = fs.readdirSync(inputRoot).filter(folder =>
    fs.statSync(path.join(inputRoot, folder)).isDirectory()
);

(async () => {
    for (const category of categories) {
        const inputDir = path.join(inputRoot, category);
        const outputDir = path.join(outputRoot, category);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        if (!galleryData[category]) {
            galleryData[category] = [];
        }

        const files = fs.readdirSync(inputDir).filter(file =>
            file.match(/\.(jpg|jpeg|png|arw)$/i)
        );

        let counter = 1;
        const existingFiles = fs.readdirSync(outputDir);
        if (existingFiles.length > 0) {
            const nums = existingFiles.map(f => {
                const match = f.match(/img-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            });
            counter = Math.max(...nums) + 1;
        }

        for (const file of files) {
            const inputPath = path.join(inputDir, file);

            try {
                const buffer = await sharp(inputPath)
                    .rotate()
                    .resize({ width: 1200 })
                    .webp({ quality: 70 })
                    .toBuffer();

                const hash = getFileHash(buffer);

                // 🔥 cek duplikat
                if (existingHashes.has(hash)) {
                    console.log("SKIP DUPLICATE:", file);

                    // optional: hapus file asli biar bersih
                    fs.unlinkSync(inputPath);

                    continue;
                }

                const newName = `img-${String(counter).padStart(3, "0")}.webp`;
                const outputPath = path.join(outputDir, newName);

                fs.writeFileSync(outputPath, buffer);

                console.log(`OK [${category}]:`, newName);

                galleryData[category].push(`assets/thumb/${category}/${newName}`);

                existingHashes.add(hash);
                counter++;

                // optional: hapus file original setelah diproses
                fs.unlinkSync(inputPath);

            } catch (err) {
                console.error("ERR:", file, err);
            }
        }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(galleryData, null, 2));

    console.log("✅ DONE (with dedup)");
})();