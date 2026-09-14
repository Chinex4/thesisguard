import { test, expect } from "@playwright/test";
test("landing page explains similarity honestly and fits the viewport", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Protect Academic/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Illustrative preview", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Check your thesis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Connect your institution" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("authentication pages show configuration status and safe forms", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByLabel("Matriculation number")).toBeVisible();
  await expect(page.getByLabel("Confirm password")).toBeVisible();
  await expect(page.locator("select[name=role]")).toHaveCount(0);
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeDisabled();
});
test("all major private routes show an honest setup state without credentials", async ({
  page,
}) => {
  for (const route of [
    "/dashboard",
    "/repository",
    "/repository/10000000-0000-4000-8000-000000000001",
    "/theses",
    "/theses/new",
    "/theses/10000000-0000-4000-8000-000000000001",
    "/theses/10000000-0000-4000-8000-000000000001/scan",
    "/scans",
    "/scans/10000000-0000-4000-8000-000000000001",
    "/reports/10000000-0000-4000-8000-000000000001",
    "/profile",
    "/supervisor",
    "/supervisor/submissions",
    "/supervisor/submissions/10000000-0000-4000-8000-000000000001",
    "/admin",
    "/admin/users",
    "/admin/theses",
    "/admin/scans",
    "/admin/departments",
    "/admin/settings",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Connect your institution" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
test("mobile navigation opens and closes accessibly", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "My theses", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My theses", exact: true }).click();
  await expect(page).toHaveURL(/\/theses$/);
});
test("API denies unauthenticated data and mutation requests", async ({
  request,
}) => {
  for (const [method, path] of [
    ["GET", "/api/scans/10000000-0000-4000-8000-000000000001"],
    ["POST", "/api/theses"],
    ["POST", "/api/uploads"],
    ["PATCH", "/api/admin/settings"],
  ]) {
    const response = await request.fetch(path, { method });
    expect(response.status()).toBe(401);
    expect(await response.json()).toHaveProperty("error");
  }
});
