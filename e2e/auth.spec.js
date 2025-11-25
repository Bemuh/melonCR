import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {

    test.beforeEach(async ({ page }) => {
        // Mock Electron APIs
        await page.addInitScript(() => {
            window.testLogs = [];
            window.logTest = (msg) => window.testLogs.push(msg);

            window.print = () => { };
            window.electronAPI = {
                exportHistoryPdf: async () => new Promise(() => { }),
            };

            // Mock DB File API (LocalStorage backed)
            window.dbFileApi = {
                loadDbBytes: async (username) => {
                    const db = localStorage.getItem(`db_${username}`);
                    return db ? Uint8Array.from(JSON.parse(db)) : null;
                },
                saveDbBytes: async (username, data) => {
                    localStorage.setItem(`db_${username}`, JSON.stringify(Array.from(data)));
                    return true;
                },
            };

            // Mock Auth API (LocalStorage backed)
            window.authApi = {
                login: async (username) => {
                    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
                    return users[username] || null;
                },
                create: async (username, userData) => {
                    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
                    if (users[username]) return { ok: false, error: 'User exists' };
                    users[username] = userData;
                    localStorage.setItem('mockUsers', JSON.stringify(users));
                    return { ok: true };
                },
                update: async (username, userData) => {
                    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
                    if (!users[username]) return { ok: false, error: 'User not found' };
                    users[username] = { ...users[username], ...userData };
                    localStorage.setItem('mockUsers', JSON.stringify(users));
                    return { ok: true };
                },
                hasUsers: async () => {
                    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
                    return Object.keys(users).length > 0;
                },
            };
        });

        await page.goto('/');
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    });

    test('Create Account and Login', async ({ page }) => {
        // Should start at Create Account since no users exist (assuming fresh localStorage per context)
        // Note: Playwright creates a fresh context for each test, so localStorage is empty.

        await expect(page.getByTestId('input-create-username')).toBeVisible();

        await page.getByTestId('input-create-username').fill('newuser');
        await page.getByTestId('input-create-password').fill('password123');

        // Debug: Check crypto availability
        const cryptoStatus = await page.evaluate(() => ({
            secure: window.isSecureContext,
            crypto: !!window.crypto,
            subtle: !!(window.crypto && window.crypto.subtle)
        }));
        console.log('TEST LOG: Crypto Status:', cryptoStatus);

        await page.getByTestId('btn-create').click();

        // Check for error message if recovery code doesn't appear
        try {
            await expect(page.getByTestId('display-recovery-code')).toBeVisible({ timeout: 3000 });
        } catch (e) {
            console.log('TEST LOG: Recovery code not visible.');
            if (await page.getByTestId('auth-error').isVisible()) {
                console.log('TEST LOG: Auth Error:', await page.getByTestId('auth-error').innerText());
            }
            // Fail explicitly
            throw e;
        }

        const recoveryCode = await page.getByTestId('display-recovery-code').innerText();
        expect(recoveryCode).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}/);

        await page.getByTestId('btn-ack-recovery').click();

        // Should be logged in and see Intake
        await expect(page.getByTestId('btn-new-patient')).toBeVisible();
    });

    test('Login Failure', async ({ page }) => {
        // Create a user first
        await page.getByTestId('input-create-username').fill('existing');
        await page.getByTestId('input-create-password').fill('pass');
        await page.getByTestId('btn-create').click();
        await page.getByTestId('btn-ack-recovery').click();

        // Logout (simulate by reload)
        await page.reload();

        // Now we should see Login screen because users exist in localStorage
        await expect(page.getByTestId('input-login-username')).toBeVisible();

        // Wrong password
        await page.getByTestId('input-login-username').fill('existing');
        await page.getByTestId('input-login-password').fill('wrongpass');
        await page.getByTestId('btn-login').click();

        await expect(page.getByTestId('auth-error')).toContainText('Contraseña incorrecta');
    });

    test('Password Recovery', async ({ page }) => {
        // 1. Create User
        await page.getByTestId('input-create-username').fill('recoverme');
        await page.getByTestId('input-create-password').fill('oldpass');
        await page.getByTestId('btn-create').click();

        const recoveryCode = await page.getByTestId('display-recovery-code').innerText();
        await page.getByTestId('btn-ack-recovery').click();

        // 2. Logout
        await page.reload();

        // 3. Go to Recovery
        await page.getByTestId('link-to-recover').click();

        // 4. Enter details
        await page.getByTestId('input-recover-username').fill('recoverme');
        await page.getByTestId('input-recovery-code').fill(recoveryCode);
        await page.getByTestId('input-new-password').fill('newpass');
        await page.getByTestId('btn-recover').click();

        // 5. Success message and redirect to login
        await expect(page.getByTestId('auth-success')).toContainText('Contraseña restablecida');

        // 6. Login with new password
        await page.getByTestId('input-login-username').fill('recoverme');
        await page.getByTestId('input-login-password').fill('newpass');
        await page.getByTestId('btn-login').click();

        await expect(page.getByTestId('btn-new-patient')).toBeVisible();
    });
});
