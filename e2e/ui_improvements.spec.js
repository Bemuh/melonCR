import { test, expect } from '@playwright/test';

test.describe('UI Improvements', () => {

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

    test('Password Toggle', async ({ page }) => {
        // Ensure we are on login/create page
        if (await page.getByTestId('btn-new-patient').isVisible()) {
            await page.getByText('Salir').click();
        }

        // We might be in 'create' mode if no users exist
        const isCreate = await page.getByTestId('input-create-password').isVisible();

        if (isCreate) {
            // Check Create Account Password Toggle
            const createPwdInput = page.getByTestId('input-create-password');
            const createToggle = page.getByTestId('toggle-password-create');

            await expect(createPwdInput).toHaveAttribute('type', 'password');
            await createToggle.click();
            await expect(createPwdInput).toHaveAttribute('type', 'text');

            // Create a user to test login toggle
            await page.getByTestId('input-create-username').fill('toggle_test');
            await page.getByTestId('input-create-password').fill('Password123');
            await page.getByTestId('btn-create').click();
            await page.waitForSelector('[data-testid="display-recovery-code"]');
            await page.getByTestId('btn-ack-recovery').click();

            // Now we are logged in. Logout to test login toggle.
            await page.getByText('Salir').click();
        }

        // Now we should be in login mode (or can switch to it)
        if (await page.getByTestId('link-to-login').isVisible()) {
            await page.getByTestId('link-to-login').click();
        }

        // Check Login Password Toggle
        const loginPwdInput = page.getByTestId('input-login-password');
        const loginToggle = page.getByTestId('toggle-password-login');

        await expect(loginPwdInput).toBeVisible();
        await expect(loginPwdInput).toHaveAttribute('type', 'password');
        await loginToggle.click();
        await expect(loginPwdInput).toHaveAttribute('type', 'text');
        await loginToggle.click();
        await expect(loginPwdInput).toHaveAttribute('type', 'password');
    });

    test('Config Modal and Styles', async ({ page }) => {
        // Login first
        const username = 'ui_test_user';
        const password = 'Password123';

        // Create if needed
        if (await page.getByTestId('btn-login').isVisible()) {
            // Login
            await page.getByTestId('input-login-username').fill(username);
            await page.getByTestId('input-login-password').fill(password);
            await page.getByTestId('btn-login').click();
        } else if (await page.getByTestId('input-create-username').isVisible()) {
            // Create
            await page.getByTestId('input-create-username').fill(username);
            await page.getByTestId('input-create-password').fill(password);
            await page.getByTestId('btn-create').click();
            await page.waitForSelector('[data-testid="display-recovery-code"]');
            await page.getByTestId('btn-ack-recovery').click();
            // Fill profile
            await page.getByTestId('input-medical-name').fill('Dr. UI');
            await page.getByTestId('btn-save-profile').click();
        }

        // Go to Config
        await page.getByText('Configuración').click();
        await expect(page.getByTestId('config-page')).toBeVisible();

        // Go to Security Tab
        await page.getByTestId('config-security-tab').click();

        // Check Password Toggles in Config
        const currentPwd = page.getByTestId('input-current-password');
        const toggleCurrent = page.getByTestId('toggle-password-current');
        await expect(currentPwd).toHaveAttribute('type', 'password');
        await toggleCurrent.click();
        await expect(currentPwd).toHaveAttribute('type', 'text');

        // Check Inactivity Timer Modal
        await page.getByTestId('config-inactivity-timeout').fill('15');

        // Mock alert to ensure it's NOT called
        page.on('dialog', dialog => {
            throw new Error(`Unexpected dialog: ${dialog.message()}`);
        });

        await page.getByTestId('config-save-timer').click();

        // Expect Modal
        await expect(page.getByText('Configuración guardada')).toBeVisible();

        // Close Modal
        await page.getByTestId('btn-modal-confirm').click();
        await expect(page.getByText('Configuración guardada')).toBeHidden();
    });

    test('Header Visibility', async ({ page }) => {
        // Login first
        const username = 'header_test_user';
        const password = 'Password123';

        // Create
        if (await page.getByTestId('btn-login').isVisible()) {
            await page.getByTestId('link-to-create').click();
            await page.getByTestId('input-create-username').fill(username);
            await page.getByTestId('input-create-password').fill(password);
            await page.getByTestId('btn-create').click();
            await page.waitForSelector('[data-testid="display-recovery-code"]');
            await page.getByTestId('btn-ack-recovery').click();
            await page.getByTestId('input-medical-name').fill('Dr. Header');
            await page.getByTestId('btn-save-profile').click();
        } else if (await page.getByTestId('input-create-username').isVisible()) {
            // Create
            await page.getByTestId('input-create-username').fill(username);
            await page.getByTestId('input-create-password').fill(password);
            await page.getByTestId('btn-create').click();
            await page.waitForSelector('[data-testid="display-recovery-code"]');
            await page.getByTestId('btn-ack-recovery').click();
            // Fill profile
            await page.getByTestId('input-medical-name').fill('Dr. Header');
            await page.getByTestId('btn-save-profile').click();
        }

        // Check Header Visible on Home
        await expect(page.getByTestId('brand-logo')).toBeVisible();

        // Create Patient to navigate to patient page
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('999999');
        await page.getByTestId('input-first-name').fill('Header');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        // Should be on patient page
        await expect(page).toHaveURL(/\/patient\/.+/);

        // Check Header HIDDEN
        await expect(page.getByTestId('brand-logo')).toBeHidden();

        // Go back (browser back or if there is a back button in UI)
        // Patient page usually has a "Volver" button?
        // Let's use page.goBack() or click a back button if exists.
        // PatientPage usually has a back button.
        // Let's check PatientPage.jsx content if needed, but assuming there is one.
        // Or just navigate manually.
        await page.goto('/');
        await page.getByTestId('input-login-username').fill(username);
        await page.getByTestId('input-login-password').fill(password);
        await page.getByTestId('btn-login').click();
        await expect(page.getByTestId('brand-logo')).toBeVisible();
    });

});
