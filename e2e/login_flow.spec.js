import { test, expect } from '@playwright/test';

test.describe('Login Flow Persistence', () => {

    test.beforeEach(async ({ page }) => {
        // Mock Electron APIs
        await page.addInitScript(() => {
            window.print = () => { };
            window.electronAPI = {
                exportHistoryPdf: async () => new Promise(() => { }),
            };

            window.configApi = {
                getDbPath: async () => ({ dbPath: '/mock/path' }),
                setDbPath: async (path) => ({ ok: true }),
                selectFolder: async () => '/mock/selected/path'
            };

            window.dbFileApi = {
                loadDbBytes: async (username) => {
                    const db = localStorage.getItem(`db_${username}`);
                    if (db) return Uint8Array.from(JSON.parse(db));
                    return null;
                },
                saveDbBytes: async (username, data) => {
                    localStorage.setItem(`db_${username}`, JSON.stringify(Array.from(data)));
                    return true;
                },
            };

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
    });

    test('Complete profile and verify persistence on restart', async ({ page }) => {
        const username = 'dr_persistence';
        const password = 'Password123';

        // 1. Create Account
        // Check if we are in create mode or login mode (depends on if other tests ran)
        // But since we use a unique username, we can just follow the flow.
        // If "Iniciar Sesión" is shown, click "Crear nueva cuenta"
        if (await page.getByTestId('btn-login').isVisible()) {
            await page.getByTestId('link-to-create').click();
        }

        await page.getByTestId('input-create-username').fill(username);
        await page.getByTestId('input-create-password').fill(password);
        await page.getByTestId('btn-create').click();

        // Ack recovery code
        await page.waitForSelector('[data-testid="display-recovery-code"]');
        await page.getByTestId('btn-ack-recovery').click();

        // 2. Should see Doctor Profile Form
        await expect(page.getByTestId('form-doctor-profile')).toBeVisible();

        // Fill profile
        await page.getByTestId('input-medical-name').fill('Dr. Persistence');
        await page.getByTestId('input-medical-license').fill('PER-123');
        await page.getByTestId('btn-save-profile').click();

        // 3. Should go to Home (Inicio)
        await expect(page.getByTestId('btn-new-patient')).toBeVisible();

        // 4. Logout
        await page.getByText('Salir').click();
        await expect(page.getByTestId('input-login-username')).toBeVisible();

        // 5. Login again
        await page.getByTestId('input-login-username').fill(username);
        await page.getByTestId('input-login-password').fill(password);
        await page.getByTestId('btn-login').click();

        // 6. Should go DIRECTLY to Home, NOT profile form
        await expect(page.getByTestId('btn-new-patient')).toBeVisible();
        await expect(page.getByTestId('form-doctor-profile')).toBeHidden();
    });
});
