import fs from 'fs';
import path from 'path';

function walkSync(dir, callback) {
  if (dir.includes('packages')) return;
  if (dir.includes('node_modules')) return;
  if (dir.includes('.next')) return;
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walkSync(filepath, callback);
    } else if (stats.isFile() && (filepath.endsWith('.ts') || filepath.endsWith('.tsx'))) {
      callback(filepath);
    }
  });
}

walkSync('./app', processFile);
walkSync('./components', processFile);
walkSync('./lib', processFile);

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;

  content = content.replace(/@\/components\/arcade-game/g, '@joop/arcade-engine');
  content = content.replace(/@\/components\/debris-icon/g, '@joop/arcade-engine');
  content = content.replace(/@\/components\/joop-sprite/g, '@joop/arcade-engine');
  content = content.replace(/@\/components\/sound-toggle/g, '@joop/arcade-engine');
  
  content = content.replace(/@\/lib\/arcade/g, '@joop/arcade-engine');
  content = content.replace(/@\/lib\/ad-satellites/g, '@joop/arcade-engine');
  content = content.replace(/@\/lib\/debris-kinds/g, '@joop/arcade-engine');
  content = content.replace(/@\/lib\/joop-sprite/g, '@joop/arcade-engine');
  content = content.replace(/@\/lib\/minigame/g, '@joop/arcade-engine');
  content = content.replace(/@\/lib\/sound-prefs/g, '@joop/arcade-engine');
  content = content.replace(/@\/lib\/sound/g, '@joop/arcade-engine');

  if (content !== original) {
    fs.writeFileSync(filepath, content);
    console.log(`Updated ${filepath}`);
  }
}
