import { test, expect } from '@playwright/test';

test.describe('Profile Persistence Bug', () => {

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

            // Mock DB File API with DELAY to simulate race condition
            window.dbFileApi = {
                loadDbBytes: async (username) => {
                    console.log(`[Mock] loadDbBytes called for ${username}`);
                    // Simulate slow disk I/O
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const db = localStorage.getItem(`db_${username}`);
                    if (db) return Uint8Array.from(JSON.parse(db));
                    return null;
                },
                saveDbBytes: async (username, data) => {
                    console.log(`[Mock] saveDbBytes called for ${username}`);
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

    test('reproduce profile form appearing after restart', async ({ page }) => {
        const username = 'bug_repro_user';
        const password = 'Password123';

        // 1. Create Account
        if (await page.getByTestId('btn-login').isVisible()) {
            await page.getByTestId('link-to-create').click();
        }
        await page.getByTestId('input-create-username').fill(username);
        await page.getByTestId('input-create-password').fill(password);
        await page.getByTestId('btn-create').click();
        await page.waitForSelector('[data-testid="display-recovery-code"]');
        await page.getByTestId('btn-ack-recovery').click();

        // 2. Complete Profile
        await expect(page.getByTestId('input-medical-name')).toBeVisible();
        await page.getByTestId('input-medical-name').fill('Dr. Bug Repro');
        await page.getByTestId('btn-save-profile').click();

        // 3. Verify we are on Home (Intake)
        await expect(page.getByTestId('btn-new-patient')).toBeVisible();

        // 4. Logout (Simulate close/restart by logging out and reloading page)
        await page.getByText('Salir').click();
        await expect(page.getByTestId('btn-login')).toBeVisible();

        // Reload page to reset in-memory state (simulate app restart)
        await page.reload();

        // 5. Login again
        await page.getByTestId('input-login-username').fill(username);
        await page.getByTestId('input-login-password').fill(password);
        await page.getByTestId('btn-login').click();

        // 6. Assert: Should go to Home, NOT Profile Form
        // If bug exists (race condition), it might show profile form
        // We expect this to FAIL if the bug is present and we simulated delay correctly
        await expect(page.getByTestId('btn-new-patient')).toBeVisible({ timeout: 5000 });
        await expect(page.getByTestId('input-medical-name')).toBeHidden();
    });

});
