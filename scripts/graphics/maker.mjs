// One time helper: squares and shrinks the maker photos for the About page. Source files are outside the repo.
import path from "node:path";
import sharp from "sharp";

const sources = [
  ["C:/Users/oyedo/Desktop/Shoot/oyedokun-9.png", "maker-1"],
  ["C:/Users/oyedo/Desktop/Oyedokun/oyedokunken.jpg", "maker-2"],
  ["C:/Users/oyedo/Desktop/Oyedokun/oyedokunken-new - Copy.jpg", "maker-3"],
  ["C:/Users/oyedo/Desktop/Oyedokun/20250911_144637(1)(1).jpg", "maker-4"],
];
const out = path.resolve(import.meta.dirname, "../../apps/web/public/images/maker");

for (const [file, name] of sources) {
  const info = await sharp(file)
    .rotate()
    .trim({ threshold: 25 })
    .resize(640, 640, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toFile(path.join(out, `${name}.webp`));
  process.stdout.write(`${name}: ${Math.round(info.size / 1024)} KB\n`);
}
