import { test, expect } from '@playwright/test'

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.snowball-header')).toBeVisible()
})

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="text"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('register page has email field', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('input[type="email"]')).toBeVisible()
})
