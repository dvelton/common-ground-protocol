import { expect, test, type Browser } from '@playwright/test';

async function createAndJoin(browser: Browser) {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const partyA = await contextA.newPage();
  const partyB = await contextB.newPage();

  await partyA.goto('/create');
  await partyA.getByLabel('Negotiation title').fill('Playwright contract negotiation');
  await partyA.getByLabel('Your party label').fill('Customer counsel');
  await partyA.getByRole('button', { name: 'Create private session' }).click();
  await expect(partyA.getByText('Invite the counterparty')).toBeVisible();

  const [sessionId, inviteCode] = await partyA.locator('.credential-grid code').allTextContents();
  expect(sessionId).toBeTruthy();
  expect(inviteCode).toBeTruthy();

  await partyB.goto('/join');
  await partyB.getByLabel('Session ID').fill(sessionId);
  await partyB.getByLabel('Invitation code').fill(inviteCode);
  await partyB.getByLabel('Your party label').fill('Provider counsel');
  await partyB.getByRole('button', { name: 'Join negotiation' }).click();

  await expect(partyA.getByText('Configure the Customer counsel agent')).toBeVisible();
  await expect(partyB.getByText('Configure the Provider counsel agent')).toBeVisible();

  return { contextA, contextB, partyA, partyB };
}

test('two private agents find and approve a multi-issue agreement', async ({ browser }) => {
  const { contextA, contextB, partyA, partyB } = await createAndJoin(browser);

  await Promise.all([
    partyA.getByRole('button', { name: 'Seal mandate and start agent' }).click(),
    partyB.getByRole('button', { name: 'Seal mandate and start agent' }).click(),
  ]);

  await expect(partyA.getByRole('button', { name: 'Approve this package' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(partyB.getByRole('button', { name: 'Approve this package' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    partyB.getByText(
      'The parties agree that the following terms form the negotiated business and legal package.',
      { exact: false },
    ),
  ).toBeVisible();

  await Promise.all([
    partyA.getByRole('button', { name: 'Approve this package' }).click(),
    partyB.getByRole('button', { name: 'Approve this package' }).click(),
  ]);

  await expect(partyA.getByText('Agreement finalized')).toBeVisible({
    timeout: 30_000,
  });
  await expect(partyB.getByText('Agreement finalized')).toBeVisible({
    timeout: 30_000,
  });
  await expect(partyA.getByText('Signed outcome receipt')).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test('failed matching reveals no unsuccessful acceptance', async ({ browser }) => {
  const { contextA, contextB, partyA, partyB } = await createAndJoin(browser);
  const selectsB = partyB.locator('.option-score select');

  for (let index = 0; index < 15; index += 1) {
    await selectsB.nth(index).selectOption('-1');
  }
  await expect(partyB.locator('.private-count')).toContainText('0authorized packages');

  await Promise.all([
    partyA.getByRole('button', { name: 'Seal mandate and start agent' }).click(),
    partyB.getByRole('button', { name: 'Seal mandate and start agent' }).click(),
  ]);

  await expect(partyA.getByText('No mutually acceptable package')).toBeVisible({
    timeout: 30_000,
  });
  await expect(partyB.getByText('No mutually acceptable package')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    partyA.getByText(
      'No individual acceptance, rejection, mandate or fallback position has been disclosed.',
    ),
  ).toBeVisible();
  await expect(partyA.getByText('Mutually accepted package')).toHaveCount(0);
  await expect(partyB.getByText('Mutually accepted package')).toHaveCount(0);

  await contextA.close();
  await contextB.close();
});
