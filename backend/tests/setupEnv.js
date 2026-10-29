// Exécuté avant chaque fichier de test, avant le chargement de src/config/env.js.
// dotenv ne remplace pas une variable déjà définie : ces valeurs l'emportent sur le .env.
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '4'; // hachage rapide : les tests créent beaucoup de comptes
process.env.LOGIN_RATE_LIMIT_MAX = '1000'; // les tests se connectent souvent depuis la même IP
