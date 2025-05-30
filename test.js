const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./shop.db');

db.run("ALTER TABLE products ADD COLUMN amount INTEGER DEFAULT 0", (err) => {
    if (err) {
        console.error('Ошибка при добавлении столбца amount:', err);
    } else {
        console.log('Столбец amount успешно добавлен в таблицу products');
    }
    db.close();
});