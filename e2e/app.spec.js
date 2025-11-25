import { test, expect } from '@playwright/test';

test.describe('Clinic App E2E', () => {

    test.beforeEach(async ({ page }) => {
        // Mock Electron APIs
        await page.addInitScript(() => {
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

        // Create and Login a default user for all tests
        // Wait for auth to initialize
        await page.waitForTimeout(500);

        // Check if we need to create account or login
        const createVisible = await page.getByTestId('input-create-username').isVisible().catch(() => false);
        const loginVisible = await page.getByTestId('input-login-username').isVisible().catch(() => false);

        if (createVisible) {
            // No users exist, create one
            await page.getByTestId('input-create-username').fill('testuser');
            await page.getByTestId('input-create-password').fill('password123');
            await page.getByTestId('btn-create').click();
            // Wait for and handle recovery code
            await page.waitForSelector('[data-testid="display-recovery-code"]', { timeout: 5000 });
            await page.getByTestId('btn-ack-recovery').click();
            // Wait for login to complete
            await page.waitForSelector('[data-testid="btn-new-patient"]', { timeout: 5000 });
        } else if (loginVisible) {
            // User exists, just login
            await page.getByTestId('input-login-username').fill('testuser');
            await page.getByTestId('input-login-password').fill('password123');
            await page.getByTestId('btn-login').click();
            // Wait for login to complete
            await page.waitForSelector('[data-testid="btn-new-patient"]', { timeout: 5000 });
        }

        // Ensure we're at the home page
        await expect(page.getByTestId('btn-new-patient')).toBeVisible();
    });

    test('Create New Patient', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();

        await page.getByTestId('input-doc-type').selectOption('CC');
        await page.getByTestId('input-doc-number').fill('123456789');
        await page.getByTestId('input-first-name').fill('Juan');
        await page.getByTestId('input-last-name').fill('Perez');
        await page.getByTestId('select-sex').selectOption('Hombre');
        await page.getByTestId('input-birth-date').fill('1990-01-01');
        await page.getByTestId('input-phone').fill('3001234567');
        await page.getByTestId('input-address').fill('Calle 123');
        await page.getByTestId('input-city').fill('Bogota');

        await page.getByTestId('btn-create').click();

        await expect(page).toHaveURL(/\/patient\/.+/);
        await expect(page.getByTestId('section-patient-data')).toBeVisible();
    });

    test('Search Existing Patient & Update', async ({ page }) => {
        // Create one first
        await page.getByTestId('btn-new-patient').click();
        const docNum = '987654321';
        await page.getByTestId('input-doc-number').fill(docNum);
        await page.getByTestId('input-first-name').fill('Maria');
        await page.getByTestId('input-last-name').fill('Gomez');
        await page.getByTestId('btn-create').click();
        await expect(page).toHaveURL(/\/patient\/.+/);

        // Now search - need to go back home first
        await page.getByTestId('btn-back-home').click();
        await page.getByTestId('btn-existing-patient').click();
        await page.getByTestId('input-search').fill(docNum);
        await page.getByTestId('btn-search').click();

        // Wait for results
        const resultItem = page.locator(`button:has-text("${docNum}")`);
        await expect(resultItem).toBeVisible();
        await resultItem.click();

        await expect(page).toHaveURL(/\/patient\/.+/);

        // Update fields
        await page.getByTestId('section-patient-data').click();
        await page.getByTestId('input-patient-phone').fill('3105551234');
        await page.getByTestId('input-patient-email').fill('test@example.com');
        await page.getByTestId('input-patient-address').fill('Calle Falsa 123');
        await page.getByTestId('input-patient-city').fill('Medellin');

        // Trigger blur to ensure save
        await page.getByTestId('input-patient-city').blur();
        // Wait a bit for DB update
        await page.waitForTimeout(500);

        // Navigate away and back to verify persistence
        await page.getByTestId('btn-back-home').click();
        await page.getByTestId('btn-existing-patient').click();
        await page.getByTestId('input-search').fill(docNum);
        await page.getByTestId('btn-search').click();
        const resultItem2 = page.locator(`button:has-text("${docNum}")`);
        await expect(resultItem2).toBeVisible();
        await resultItem2.click();

        await expect(page.getByTestId('input-patient-phone')).toHaveValue('3105551234');
        await expect(page.getByTestId('input-patient-email')).toHaveValue('test@example.com');
        await expect(page.getByTestId('input-patient-address')).toHaveValue('Calle Falsa 123');
        await expect(page.getByTestId('input-patient-city')).toHaveValue('Medellin');
    });

    test('Change Encounter Type', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('111222333');
        await page.getByTestId('input-first-name').fill('Test');
        await page.getByTestId('input-last-name').fill('Type');
        await page.getByTestId('btn-create').click();

        // Default is first_visit, so Procedures shouldn't be visible
        // Switch to Minor Procedure
        await page.getByTestId('select-encounter-type').selectOption('minor_procedure');

        // Verify Procedures section appears
        await expect(page.getByTestId('section-procedures')).toBeVisible();

        // Switch back
        await page.getByTestId('select-encounter-type').selectOption('first_visit');
        await expect(page.getByTestId('section-procedures')).toBeHidden();
    });

    test('Vitals Persistence', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('555666777');
        await page.getByTestId('input-first-name').fill('Vitals');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        // Open Vitals
        const vitalsSection = page.getByTestId('section-vitals');
        if (await vitalsSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await vitalsSection.locator('button.collapser').click();
        }

        await page.getByTestId('input-vitals-taS').fill('120');
        await page.getByTestId('input-vitals-taD').fill('80');
        await page.getByTestId('input-vitals-fc').fill('70');
        await page.getByTestId('input-vitals-fr').fill('18');
        await page.getByTestId('input-vitals-temp').fill('36.5');
        await page.getByTestId('input-vitals-spo2').fill('98');
        await page.getByTestId('input-vitals-talla').fill('170');
        await page.getByTestId('input-vitals-peso').fill('70');
        await page.getByTestId('input-vitals-peso').blur();

        await page.waitForTimeout(500);

        // Navigate away and back to verify persistence
        const patientUrl = page.url();
        await page.getByTestId('btn-back-home').click();
        await page.goto(patientUrl);
        await page.waitForTimeout(500);

        if (await vitalsSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await vitalsSection.locator('button.collapser').click();
        }

        await expect(page.getByTestId('input-vitals-taS')).toHaveValue('120');
        await expect(page.getByTestId('input-vitals-taD')).toHaveValue('80');
        await expect(page.getByTestId('input-vitals-fc')).toHaveValue('70');
        await expect(page.getByTestId('input-vitals-fr')).toHaveValue('18');
        await expect(page.getByTestId('input-vitals-temp')).toHaveValue('36.5');
        await expect(page.getByTestId('input-vitals-spo2')).toHaveValue('98');
        await expect(page.getByTestId('input-vitals-talla')).toHaveValue('170');
        await expect(page.getByTestId('input-vitals-peso')).toHaveValue('70');
    });

    test('Text Areas Persistence', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('999888777');
        await page.getByTestId('input-first-name').fill('Text');
        await page.getByTestId('input-last-name').fill('Areas');
        await page.getByTestId('btn-create').click();

        const chief = 'Dolor de cabeza intenso';
        const hpi = 'Paciente refiere dolor desde hace 3 dias';
        const pe = 'Paciente alerta, orientado';
        const analysis = 'Migraña probable';
        const plan = 'Acetaminofen 500mg';

        async function openAndFill(sectionId, inputId, value) {
            const section = page.getByTestId(sectionId);
            const btn = section.locator('button.collapser');
            const expanded = await btn.getAttribute('aria-expanded');
            if (expanded === 'false') {
                await btn.click();
            }
            await page.getByTestId(inputId).fill(value);
            await page.getByTestId(inputId).blur();
        }

        await openAndFill('section-chief-complaint', 'input-chief-complaint', chief);
        await openAndFill('section-hpi', 'input-hpi', hpi);
        await openAndFill('section-physical-exam', 'input-physical-exam', pe);
        await openAndFill('section-analysis', 'input-analysis', analysis);
        await openAndFill('section-plan', 'input-plan', plan);

        await page.waitForTimeout(500);

        // Navigate away and back to verify persistence
        const patientUrl = page.url();
        await page.getByTestId('btn-back-home').click();
        await page.goto(patientUrl);
        await page.waitForTimeout(500);

        async function verify(sectionId, inputId, value) {
            const section = page.getByTestId(sectionId);
            const btn = section.locator('button.collapser');
            const expanded = await btn.getAttribute('aria-expanded');
            if (expanded === 'false') {
                await btn.click();
            }
            await expect(page.getByTestId(inputId)).toHaveValue(value);
        }

        await verify('section-chief-complaint', 'input-chief-complaint', chief);
        await verify('section-hpi', 'input-hpi', hpi);
        await verify('section-physical-exam', 'input-physical-exam', pe);
        await verify('section-analysis', 'input-analysis', analysis);
        await verify('section-plan', 'input-plan', plan);
    });

    test('Diagnoses Management & ICD10 Loading', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('123123123');
        await page.getByTestId('input-first-name').fill('Dx');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        // Open Diagnoses section
        const dxSection = page.getByText('Diagnósticos (CIE-10)').locator('..').locator('..');
        if (await dxSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await dxSection.locator('button.collapser').click();
        }

        // Test ICD10 Autosuggest
        await page.getByTestId('dx-principal-code').fill('J0');
        await expect(page.locator('ul.suggest li').first()).toBeVisible();
        await page.getByTestId('dx-principal-code').fill('J00');
        // Use regex for flexible matching
        await page.locator('ul.suggest li', { hasText: /J00 — Rinofaringitis aguda/ }).click();

        // Select Type
        await page.getByTestId('select-dx-type').selectOption({ label: '2 - Confirmado Nuevo' });

        // Save
        await page.getByTestId('btn-save-dx').click();

        // Go back home to search for the patient
        await page.getByTestId('btn-back-home').click();
        await page.getByTestId('btn-existing-patient').click();

        // await page.getByTestId('btn-search').click();

        await page.getByTestId('input-search').fill('123123123');
        await page.getByTestId('btn-search').click();
        await page
            .locator('button[data-testid^="list-result-item-"]', {
                hasText: 'Dx Test — CC 123123123',
            })
            .click();

        await expect(page.getByTestId('dx-principal-code')).toHaveValue('J00');
        await expect(page.getByTestId('dx-principal-label')).toHaveValue(/Rinofaringitis aguda/);
        const dxTypeSelect = page.getByTestId('select-dx-type');
        await expect(dxTypeSelect.locator('option:checked')).toHaveText('2 - Confirmado Nuevo');
    });

    test('Prescription Management & Deletion', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('444555666');
        await page.getByTestId('input-first-name').fill('Rx');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        const rxSection = page.locator('h2', { hasText: 'Fórmula médica' }).locator('..').locator('..');
        if (await rxSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await rxSection.locator('button.collapser').click();
        }

        await page.getByTestId('input-rx-name').fill('Ibuprofeno');
        await page.getByTestId('input-rx-dose').fill('1');
        await page.getByTestId('input-rx-freq').fill('8');
        await page.getByTestId('input-rx-days').fill('5');
        await page.getByTestId('input-rx-indications').fill('Tomar con comida');
        await page.getByTestId('btn-add-rx').click();

        // Verify added
        await expect(page.getByText('Ibuprofeno')).toBeVisible();
        await expect(page.getByText('Tomar con comida')).toBeVisible();

        // Delete
        const deleteBtn = page.locator('button:has-text("Eliminar")').first();
        await deleteBtn.click();

        // Verify deleted
        await expect(page.getByText('Ibuprofeno')).toBeHidden();
    });

    test('Encounter Navigation', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('777000777');
        await page.getByTestId('input-first-name').fill('Nav');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        // Encounter 1
        const chief1 = 'First Encounter';
        await page.getByTestId('section-chief-complaint').click();
        await page.getByTestId('input-chief-complaint').fill(chief1);
        await page.getByTestId('input-chief-complaint').blur();

        // Create New Encounter
        await page.getByTestId('select-encounter').selectOption('__new__');
        await page.waitForTimeout(1000); // Wait for switch

        // Encounter 2
        const chief2 = 'Second Encounter';
        await page.getByTestId('section-chief-complaint').click();
        await page.getByTestId('input-chief-complaint').fill(chief2);
        await page.getByTestId('input-chief-complaint').blur();

        // Switch back to Encounter 1
        // The list is ordered by date DESC.
        // Enc 2 (newest) -> index 1
        // Enc 1 (oldest) -> index 2
        // New Option -> index 0

        // Let's verify the options count to be sure
        const options = page.getByTestId('select-encounter').locator('option');
        await expect(options).toHaveCount(3);

        await page.getByTestId('select-encounter').selectOption({ index: 2 });
        await page.waitForTimeout(1000);

        await expect(page.getByTestId('input-chief-complaint')).toHaveValue(chief1);

        // Switch to Encounter 2 (index 1)
        await page.getByTestId('select-encounter').selectOption({ index: 1 });
        await page.waitForTimeout(1000);

        await expect(page.getByTestId('input-chief-complaint')).toHaveValue(chief2);
    });

    test('Procedures & Attachments (Mocked)', async ({ page }) => {
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('888999000');
        await page.getByTestId('input-first-name').fill('Proc');
        await page.getByTestId('input-last-name').fill('Att');
        await page.getByTestId('btn-create').click();

        await page.getByTestId('select-encounter-type').selectOption('minor_procedure');

        // Open Procedures section
        const procSection = page.getByTestId('section-procedures');
        if (await procSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await procSection.locator('button.collapser').click();
        }

        await page.getByTestId('input-procedure-name').fill('Biopsia');
        await page.getByTestId('input-procedure-description').fill('Toma de muestra');
        await page.getByTestId('checkbox-procedure-consent').check();

        // Open Attachments section
        const attSection = page.getByTestId('section-attachments');
        await expect(attSection).toBeVisible();
        if (await attSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await attSection.locator('button.collapser').click();
        }

        // Attachments
        const buffer = Buffer.from('dummy content');

        await page.getByTestId('input-procedure-file').setInputFiles({
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: buffer,
        });

        // Wait for upload to process (it's async)
        await page.waitForTimeout(1000);

        // Verify attachment in list
        await expect(page.getByText('test.txt')).toBeVisible();

        // Delete attachment
        const deleteBtn = page.getByTestId('section-attachments').locator('button:has-text("Eliminar")').first();
        await deleteBtn.click();

        await expect(page.getByText('test.txt')).toBeHidden();
    });

});
