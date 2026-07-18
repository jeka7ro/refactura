import { createAccount } from './server/auth';
async function run() {
  try {
    await createAccount('jeka7ro@gmail.com', 'Admin123!', undefined, 'admin');
    console.log('Account created successfully!');
  } catch (err) {
    console.error('Error creating account:', err);
  }
  process.exit(0);
}
run();
