const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const ZIP_PATH = './seu-arquivo.zip'; // Caminho para o seu .zip
const OUTPUT_DIR = './dist_flat';     // Pasta final onde todos os arquivos ficarão

// Garante que a pasta de saída existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const zip = new AdmZip(ZIP_PATH);
const zipEntries = zip.getEntries();

zipEntries.forEach((entry) => {
  // Ignora se for apenas um diretório
  if (entry.isDirectory) {
    return;
  }

  // Pega apenas o nome final do arquivo (ex: 'route.ts' ou 'package.json')
  let fileName = path.basename(entry.entryName);

  // Define o caminho de destino achatado (sem subpastas)
  let targetPath = path.join(OUTPUT_DIR, fileName);

  // Tratamento de conflitos: se dois arquivos tiverem o mesmo nome em subpastas diferentes
  // (ex: vários arquivos chamados 'route.ts'), adiciona um sufixo para não sobrescrever
  let counter = 1;
  const ext = path.extname(fileName);
  const nameOnly = path.basename(fileName, ext);

  while (fs.existsSync(targetPath)) {
    targetPath = path.join(OUTPUT_DIR, `${nameOnly}_${counter}${ext}`);
    counter++;
  }

  // Grava o conteúdo direto na raiz da pasta de saída
  fs.writeFileSync(targetPath, entry.getData());
});

console.log('✅ Arquivos extraídos e todas as subpastas foram removidas com sucesso!');
