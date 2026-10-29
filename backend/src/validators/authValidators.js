const { z } = require('zod');

const email = z
  .string()
  .trim()
  .toLowerCase() // "Alice@Mail.com" et "alice@mail.com" désignent le même compte
  .pipe(z.email('Adresse email invalide'));

const password = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(72, 'Le mot de passe ne doit pas dépasser 72 caractères'); // limite de bcrypt

const nom = z.string().trim().min(2).max(100);

const register = z.object({
  body: z.object({ email, password, nom }),
});

const registerOrganisateur = z.object({
  body: z.object({
    email,
    password,
    nom,
    nom_organisation: z.string().trim().min(2).max(150),
    ville: z.string().trim().min(2).max(100),
    description: z.string().trim().max(2000).optional(),
  }),
});

const login = z.object({
  body: z.object({ email, password: z.string().min(1) }),
});

module.exports = { register, registerOrganisateur, login };
