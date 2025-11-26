import { test, expect } from '@playwright/test';

test.describe('Doctor Profile and Config', () => {

    test.beforeEach(async ({ page }) => {
        // Mock Electron APIs
        await page.addInitScript(() => {
            window.print = () => { };
            window.electronAPI = {
                exportHistoryPdf: async () => new Promise(() => { }),
            };

            // Mock Config API (auto-configure to skip DbDiscovery)
            window.configApi = {
                getDbPath: async () => ({ dbPath: '/mock/path' }),
                setDbPath: async (path) => ({ ok: true }),
                selectFolder: async () => '/mock/selected/path'
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
        await page.waitForTimeout(500);
    });

    test('Password Validation - Minimum Length', async ({ page }) => {
        await expect(page.getByTestId('input-create-username')).toBeVisible();

        await page.getByTestId('input-create-username').fill('testuser');
        await page.getByTestId('input-create-password').fill('short');
        await page.getByTestId('btn-create').click();

        // Should show error about password length
        await expect(page.getByTestId('auth-error')).toContainText('al menos 8 caracteres');
    });

    test('Password Validation - Complexity Required', async ({ page }) => {
        await page.getByTestId('input-create-username').fill('testuser');
        await page.getByTestId('input-create-password').fill('onlyletters');
        await page.getByTestId('btn-create').click();

        // Should show error about complexity
        await expect(page.getByTestId('auth-error')).toContainText('letras y números');
    });

    test('Doctor Profile - First Login Requires Profile', async ({ page }) => {
        // Create account
        await page.getByTestId('input-create-username').fill('newdoc');
        await page.getByTestId('input-create-password').fill('password123');
        await page.getByTestId('btn-create').click();

        // Acknowledge recovery code
        await page.waitForSelector('[data-testid="display-recovery-code"]', { timeout: 5000 });
        await page.getByTestId('btn-ack-recovery').click();

        // Should see doctor profile form (not Intake)
        await expect(page.locator('h2:has-text("Perfil del Médico")')).toBeVisible();

        // Fill profile
        await page.locator('input[placeholder="Dr. Juan Pérez"]').fill('Dr. Test Doctor');
        await page.locator('input[name="medical_license"]').fill('RM9999');
        await page.locator('input[name="specialty"]').fill('Pediatría');

        // Save profile
        await page.locator('button:has-text("Guardar Perfil")').click();

        // Should now see Intake page
        await expect(page.getByTestId('btn-new-patient')).toBeVisible();
    });

    test('Configuration Panel - Navigate and Edit Profile', async ({ page }) => {
        // Create and login
        await page.getByTestId('input-create-username').fill('configtest');
        await page.getByTestId('input-create-password').fill('password123');
        await page.getByTestId('btn-create').click();
        await page.waitForSelector('[data-testid="display-recovery-code"]');
        await page.getByTestId('btn-ack-recovery').click();

        // Complete doctor profile
        await page.locator('input[placeholder="Dr. Juan Pérez"]').fill('Dr. Config Test');
        await page.locator('input[name="medical_license"]').fill('RM1111');
        await page.locator('button:has-text("Guardar Perfil")').click();

        // Navigate to config
        await page.locator('a:has-text("Configuración")').click();

        // Should see config panel with Profile tab active
        await expect(page.locator('h1:has-text("Configuración")')).toBeVisible();

        // Verify profile tab shows doctor info
        await expect(page.locator('input[value="Dr. Config Test"]')).toBeVisible();
    });

    test('Configuration Panel - Change Password', async ({ page }) => {
        // Create and login
        await page.getByTestId('input-create-username').fill('pwdchange');
        await page.getByTestId('input-create-password').fill('oldpass123');
        await page.getByTestId('btn-create').click();
        await page.waitForSelector('[data-testid="display-recovery-code"]');
        const recoveryCode = await page.getByTestId('display-recovery-code').innerText();
        await page.getByTestId('btn-ack-recovery').click();

        // Skip doctor profile
        await page.locator('button:has-text("Guardar Perfil")').click();

        // Navigate to config -> Security tab
        await page.locator('a:has-text("Configuración")').click();
        await page.locator('button:has-text("Seguridad")').click();

        // Change password
        await page.getByLabel('Contraseña actual').fill('oldpass123');
        await page.getByLabel('Nueva Contraseña').first().fill('newpass456');
        await page.getByLabel('Confirmar Nueva Contraseña').fill('newpass456');
        await page.locator('button:has-text("Actualizar Contraseña")').click();

        // Should see success message
        await expect(page.locator('text=/Contraseña actualizada/')).toBeVisible();

        // Logout and login with new password
        await page.locator('button:has-text("Salir")').click();
        
        await page.getByTestId('input-login-username').fill('pwdchange');
        await page.getByTestId('input-login-password').fill('newpass456');
        await page.getByTestId('btn-login').click();

        await expect(page.getByTestId('btn-new-patient')).toBeVisible();
    });

    test('Navigation - TopBar Links Work', async ({ page }) => {
        // Create and login
        await page.getByTestId('input-create-username').fill('navtest');
        await page.getByTestId('input-create-password').fill('password123');
        await page.getByTestId('btn-create').click();
        await page.waitForSelector('[data-testid="display-recovery-code"]');
        await page.getByTestId('btn-ack-recovery').click();
        await page.locator('button:has-text("Guardar Perfil")').click();

        // Test navigation
        await page.locator('a:has-text("Configuración")').click();
        await expect(page.locator('h1:has-text("Configuración")')).toBeVisible();

        await page.locator('a:has-text("Inicio")').click();

        // Fill profile
        await page.locator('input[placeholder="Dr. Juan Pérez"]').fill('Dr. Test Doctor');
        await page.locator('input[name="medical_license"]').fill('RM9999');
        await page.locator('input[name="specialty"]').fill('Pediatría');

        // Save profile
        await page.locator('button:has-text("Guardar Perfil")').click();

        await expect(page.getByTestId('btn-new-patient')).toBeVisible();

        // Test logout
        await page.locator('button:has-text("Salir")').click();
        await expect(page.getByTestId('input-login-username')).toBeVisible();
    });
});
