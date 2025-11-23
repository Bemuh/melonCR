import { test, expect } from '@playwright/test';

test.describe('Clinic App E2E', () => {

    test('Create New Patient', async ({ page }) => {
        await page.goto('/');
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

    test('Search Existing Patient', async ({ page }) => {
        // Create one first
        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        const docNum = '987654321';
        await page.getByTestId('input-doc-number').fill(docNum);
        await page.getByTestId('input-first-name').fill('Maria');
        await page.getByTestId('input-last-name').fill('Gomez');
        await page.getByTestId('btn-create').click();
        await expect(page).toHaveURL(/\/patient\/.+/);

        // Now search
        await page.goto('/');
        await page.getByTestId('btn-existing-patient').click();
        await page.getByTestId('input-search').fill(docNum);
        await page.getByTestId('btn-search').click();

        // Wait for results
        const resultItem = page.locator(`button:has-text("${docNum}")`);
        await expect(resultItem).toBeVisible();
        await resultItem.click();

        await expect(page).toHaveURL(/\/patient\/.+/);
    });

    test('Change Encounter Type', async ({ page }) => {
        await page.goto('/');
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

    test('Change Encounter Date', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('555666777');
        await page.getByTestId('input-first-name').fill('Date');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        const newDate = '2023-12-25T10:00';
        await page.getByTestId('input-encounter-date').fill(newDate);

        // Reload to verify persistence
        await page.reload();
        await expect(page.getByTestId('input-encounter-date')).toHaveValue(newDate);
    });

    test('Patient Fields Update', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('btn-new-patient').click();
    await page.getByTestId('input-doc-number').fill('777888999');
    await page.getByTestId('input-first-name').fill('Fields');
    await page.getByTestId('input-last-name').fill('Test');
    await page.getByTestId('btn-create').click();

    // Update fields
    await page.getByTestId('section-patient-data').click();
    await page.getByLabel('Teléfono').fill('3105551234');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Dirección').fill('Calle Falsa 123');
    await page.getByLabel('Ciudad').fill('Medellin');

    // Reload to verify persistence
    await page.reload();

    await expect(page.getByLabel('Teléfono')).toHaveValue('3105551234');
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com');
    await expect(page.getByLabel('Dirección')).toHaveValue('Calle Falsa 123');
    await expect(page.getByLabel('Ciudad')).toHaveValue('Medellin');
    });

    test('Diagnoses Management', async ({ page }) => {
        await page.goto('/');
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

        // Fill Principal Diagnosis
        // Note: AutoSuggest inputs have data-testid="{testId}-code" and "{testId}-label"
        await page.getByTestId('dx-principal-code').fill('J00');
        await page.getByTestId('dx-principal-label').fill('Rinofaringitis aguda');

        // Select Type
        await page.getByTestId('select-dx-type').selectOption({ label: '1 - Impresión Diagnóstica' });

        // Save
        await page.getByTestId('btn-save-dx').click();

        // Reload and verify
        await page.reload();
        // Re-open if needed (it might be open if not empty, but let's check)
        if (await dxSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await dxSection.locator('button.collapser').click();
        }
        await expect(page.getByTestId('dx-principal-code')).toHaveValue('J00');
    });

    test('Procedures Management (Minor Procedure)', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('456456456');
        await page.getByTestId('input-first-name').fill('Proc');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        // Switch to Minor Procedure
        await page.getByTestId('select-encounter-type').selectOption('minor_procedure');

        // Open Procedures section
        const procSection = page.getByTestId('section-procedures');
        await expect(procSection).toBeVisible();
        if (await procSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await procSection.locator('button.collapser').click();
        }

        // Fill Procedure
        await page.getByTestId('input-procedure-name').fill('Sutura');
        await page.getByTestId('input-procedure-description').fill('Sutura de herida en mano');
        await page.getByTestId('checkbox-procedure-consent').check();
        await page.getByTestId('input-procedure-notes').fill('Paciente tranquilo');

        // Reload and verify
        await page.reload();
        if (await procSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await procSection.locator('button.collapser').click();
        }
        await expect(page.getByTestId('input-procedure-name')).toHaveValue('Sutura');
        await expect(page.getByTestId('checkbox-procedure-consent')).toBeChecked();
    });

    test('Export Consistency (Robust)', async ({ page }) => {
        // Mock Electron API for this test to enable the button
        await page.addInitScript(() => {
            window.electronAPI = {
                exportHistoryPdf: async () => Promise.resolve(true),
            };
        });

        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('999888777');
        await page.getByTestId('input-first-name').fill('Export');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        // Fill all fields
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
        }

        await openAndFill('section-chief-complaint', 'input-chief-complaint', chief);
        await openAndFill('section-hpi', 'input-hpi', hpi);
        await openAndFill('section-physical-exam', 'input-physical-exam', pe);
        await openAndFill('section-analysis', 'input-analysis', analysis);
        await openAndFill('section-plan', 'input-plan', plan);

        // Vitals
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

        // Export
        await page.getByTestId('btn-export-history').click();

        // Wait for navigation
        await page.waitForURL(/\/print\/.+/);

        // Verify Print View
        await expect(page.getByTestId('print-patient-name')).toContainText('Export');
        await expect(page.getByTestId('print-section-chief-complaint')).toContainText(chief);
        await expect(page.getByTestId('print-section-hpi')).toContainText(hpi);
        await expect(page.getByTestId('print-section-physical-exam')).toContainText(pe);
        await expect(page.getByTestId('print-section-analysis')).toContainText(analysis);
        await expect(page.getByTestId('print-section-plan')).toContainText(plan);

        // Verify Vitals in text
        await expect(page.getByTestId('print-section-vitals')).toContainText('TA 120/80');
        await expect(page.getByTestId('print-section-vitals')).toContainText('FC 70');
    });

    test('Prescription Export', async ({ page }) => {
        // Mock Electron API
        await page.addInitScript(() => {
            window.electronAPI = {
                exportHistoryPdf: async () => Promise.resolve(true),
            };
        });

        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('444555666');
        await page.getByTestId('input-first-name').fill('Rx');
        await page.getByTestId('input-last-name').fill('Test');
        await page.getByTestId('btn-create').click();

        const rxSection = page.locator('h2', { hasText: 'Fórmula médica' }).locator('..').locator('..'); // Parent card
        // Open if closed
        if (await rxSection.locator('button.collapser').getAttribute('aria-expanded') === 'false') {
            await rxSection.locator('button.collapser').click();
        }

        // Use new testIds
        await page.getByTestId('input-rx-name').fill('Ibuprofeno');
        await page.getByTestId('input-rx-dose').fill('1');
        await page.getByTestId('input-rx-freq').fill('8');
        await page.getByTestId('input-rx-days').fill('5');
        await page.getByTestId('btn-add-rx').click();

        // Now Export Rx
        await page.getByTestId('btn-export-rx').click();

        // Wait for navigation
        await page.waitForURL(/\/rx\/.+/);

        // Verify Print Prescription View
        await expect(page.getByTestId('print-rx-patient-name')).toContainText('Rx');
        await expect(page.getByTestId('print-rx-item')).toContainText('Ibuprofeno');
    });

    test('Web Print View', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('999000111');
        await page.getByTestId('input-first-name').fill('Print');
        await page.getByTestId('input-last-name').fill('Web');
        await page.getByTestId('btn-create').click();

        // Click "Ver impresión" (Web version of Export)
        await page.getByTestId('btn-export-history').click();

        // Verify navigation to print view
        await page.waitForURL(/\/print\/.+/);
        await expect(page.getByTestId('print-patient-name')).toContainText('Print Web');
    });

    test('Negative - Duplicate Patient', async ({ page }) => {
        // Create first
        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('000000001');
        await page.getByTestId('input-first-name').fill('Dup');
        await page.getByTestId('input-last-name').fill('One');
        await page.getByTestId('btn-create').click();

        // Try create second with same doc
        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        await page.getByTestId('input-doc-number').fill('000000001');
        await page.getByTestId('input-first-name').fill('Dup');
        await page.getByTestId('input-last-name').fill('Two');
        await page.getByTestId('btn-create').click();

        // Expect Modal
        await expect(page.getByTestId('modal-container')).toBeVisible();
        await expect(page.getByText('Paciente existente')).toBeVisible();
    });

    test('Negative - Missing Fields', async ({ page }) => {
        await page.goto('/');
        await page.getByTestId('btn-new-patient').click();
        // Don't fill anything
        await page.getByTestId('btn-create').click();

        // Expect Modal
        await expect(page.getByTestId('modal-container')).toBeVisible();
        await expect(page.getByText('Datos incompletos')).toBeVisible();
    });

});
