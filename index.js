const fs = require('fs');
const path = require('path');
const natural = require('natural');
const { WordTokenizer } = natural;
const mammoth = require('mammoth');

class AntiPlagiarism {
    constructor() {
        this.tokenizer = new WordTokenizer();
        this.nGramSize = 4; // Размер n-граммы для сравнения
        this.minSimilarity = 0.3; // Минимальная схожесть для учета заимствования
    }

    // Основной метод для проверки плагиата
    async checkPlagiarism(directoryPath, outputFile = null) {
        try {
            // 1. Загрузка и обработка документов
            const documents = await this.loadDocuments(directoryPath);
            
            // 2. Анализ текста и создание n-грамм
            const processedDocs = documents.map(doc => ({
                ...doc,
                nGrams: this.createNGrams(doc.text)
            }));
            
            // 3. Сравнение документов
            const results = this.compareDocuments(processedDocs);
            
            // 4. Формирование и вывод отчета
            this.generateReport(results, outputFile);
            
            return results;
        } catch (error) {
            console.error('Ошибка при проверке плагиата:', error);
            throw error;
        }
    }

    // Загрузка документов из директории
    async loadDocuments(directoryPath) {
        const files = fs.readdirSync(directoryPath);
        const documents = [];
        
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const ext = path.extname(file).toLowerCase();
            
            let text = '';
            
            if (ext === '.txt') {
                text = fs.readFileSync(filePath, 'utf-8');
            } else if (ext === '.doc' || ext === '.docx') {
                const result = await mammoth.extractRawText({ path: filePath });
                text = result.value;
            } else {
                continue; // Пропускаем неподдерживаемые форматы
            }
            
            documents.push({
                fileName: file,
                path: filePath,
                text: this.preprocessText(text)
            });
        }
        
        return documents;
    }

    // Предварительная обработка текста
    preprocessText(text) {
        // Приведение к нижнему регистру, удаление лишних пробелов и знаков препинания
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Создание n-грамм из текста
    createNGrams(text) {
        const tokens = this.tokenizer.tokenize(text);
        const nGrams = new Set();
        
        for (let i = 0; i <= tokens.length - this.nGramSize; i++) {
            const nGram = tokens.slice(i, i + this.nGramSize).join(' ');
            nGrams.add(nGram);
        }
        
        return nGrams;
    }

    // Сравнение документов между собой
    compareDocuments(documents) {
        const results = [];
        
        for (let i = 0; i < documents.length; i++) {
            const doc1 = documents[i];
            const result = {
                fileName: doc1.fileName,
                totalNGrams: doc1.nGrams.size,
                matches: []
            };
            
            for (let j = 0; j < documents.length; j++) {
                if (i === j) continue; // Пропускаем сравнение с самим собой
                
                const doc2 = documents[j];
                const commonNGrams = this.countCommonNGrams(doc1.nGrams, doc2.nGrams);
                const similarity = commonNGrams / doc1.nGrams.size;
                
                if (similarity >= this.minSimilarity) {
                    result.matches.push({
                        sourceFile: doc2.fileName,
                        commonNGrams,
                        similarity: Math.round(similarity * 100)
                    });
                }
            }
            
            // Расчет оригинальности
            const totalMatches = result.matches.reduce((sum, m) => sum + m.similarity, 0);
            result.originality = Math.max(0, 100 - totalMatches);
            
            results.push(result);
        }
        
        return results;
    }

    // Подсчет общих n-грамм между двумя документами
    countCommonNGrams(nGrams1, nGrams2) {
        let count = 0;
        
        for (const nGram of nGrams1) {
            if (nGrams2.has(nGram)) {
                count++;
            }
        }
        
        return count;
    }

    // Генерация отчета
    generateReport(results, outputFile = null) {
        let report = 'АНТИПЛАГИАТ - ОТЧЕТ О ПРОВЕРКЕ\n\n';
        
        results.forEach(result => {
            report += `Документ: ${result.fileName}\n`;
            report += `Оригинальность: ${result.originality}%\n`;
            
            if (result.matches.length > 0) {
                report += 'Найдены заимствования из:\n';
                result.matches.forEach(match => {
                    report += `- ${match.sourceFile}: ${match.similarity}% совпадений (${match.commonNGrams} n-грамм)\n`;
                });
            } else {
                report += 'Заимствования не обнаружены.\n';
            }
            
            report += '\n';
        });
        
        // Вывод в консоль
        console.log(report);
        
        // Сохранение в файл, если указан
        if (outputFile) {
            fs.writeFileSync(outputFile, report, 'utf-8');
            console.log(`Отчет сохранен в файл: ${outputFile}`);
        }
    }
}

// Использование программы
const antiPlag = new AntiPlagiarism();

// Параметры: путь к папке с документами, файл для отчета (опционально)
antiPlag.checkPlagiarism('./documents', './plagiarism_report.txt')
    .catch(console.error);
