import puppeteer from 'puppeteer-extra';
import userAgent from 'user-agents';
import stealth from 'puppeteer-extra-plugin-stealth';
import adblocker from 'puppeteer-extra-plugin-adblocker';
import { executablePath } from 'puppeteer';

puppeteer.use(stealth());
puppeteer.use(adblocker({ blockTrackers: true }))

export async function request(req) {
	const amount = req.amount;
	const users = req.users;
	const note = req.note;

	const attempts = 1;
	var attemptCount = 0;
	while(attemptCount < attempts) {
		try {
			const browser = await puppeteer.launch({
				headless: false,
				slowMo: 10,
				executablePath: executablePath()
			});
			const [page] = await browser.pages();
			var randomUserAgent = new userAgent({ deviceCategory: 'desktop' });
			await page.setUserAgent(randomUserAgent.toString());
			await page.goto('https://venmo.com');
			await page.setViewport({ width: 1920, height: 1080 })
			await page.locator('a ::-p-text(Log in)').click();

			console.log("Entering Account Info");
			await page.locator('#email').fill(process.env.VENMO_ID);
			await page.locator('#btnNext').click();
			await page.locator('#password').fill(process.env.VENMO_PASS);
			await page.locator('#btnLogin').click();
			await page.waitForNavigation({waitUntil: 'networkidle0'});

			// If "Something went wrong" page or logged in successfully
			const badSelectors = ['h1 ::-p-text(Something went wrong)']
			const waitForFirstSelector = async (badSelectors) => {
				const promises = badSelectors.map(selector =>
				  page.waitForSelector(selector, { timeout: 0 }).then(() => selector)
				);
				return Promise.race(promises);
			  };

			const firstSelector = await waitForFirstSelector(badSelectors);
			if (badSelectors.includes(firstSelector)) {
				console.error('Something went wrong. Aborting');
				await browser.close();
				return;
			}

			await page.locator('span ::-p-text(Confirm another way)').click();
			await page.waitForNavigation({waitUntil: 'networkidle0'});

			await page.locator('#confirm-input').fill(process.env.BANK_ACCT_NUM);

			const [checkingSpan] = await page.$x('//span[contains(., "Confirm another way")]');
			if (checkingSpan) {
				await checkingSpan.click();
			}
			else {
				await browser.close();
				throw('attempt failed');
			}
			await page.waitForNavigation({waitUntil: 'networkidle0'});
			await page.locator('#confirm-input').type(process.env.wells_fargo_acc);

			[confirmSpan] = await page.$x('//span[contains(., "Confirm it")]');
			if (confirmSpan) {
				await confirmSpan.click();
			}
			else {
				await browser.close();
				throw('attempt failed');
			}

			await page.waitForNavigation({waitUntil: 'networkidle0'});
			const [notNowSpan] = await page.$x('//span[contains(., "Not now")]');
			if (notNowSpan) {
				await notNowSpan.click();
			}
			else {
				await browser.close();
				throw('attempt failed');
			}

			await page.waitForNavigation({waitUntil: 'networkidle0'});

			await page.goto("https://account.venmo.com/pay", {
				waitUntil: 'networkidle0',
			});

			await page.evaluate((amount) => {
				let elements = document.getElementsByTagName('input');
				for (i = 0; i < elements.length; i++) {
					if(elements[i].ariaLabel === "Amount" && elements[i].value === "0") {
						elements[i].value = String(parseFloat(amount).toFixed(2));
						elements[i].id = "amount-input";
					}
				}
			}, amount);

			await page.waitForSelector('#amount-input'); 
			await page.locator('#amount-input').type(String(parseFloat(amount).toFixed(2)));
			await page.locator('#search-input').click();

			// Everything following is outdated and a WIP

			for(var i = 0; i < users.length; i++) {
				await page.keyboard.type(users[i]);
				await page.waitForTimeout(5000);
				await page.keyboard.press('ArrowDown');
				await page.keyboard.press('Enter');
			}
			await page.waitForTimeout(1000);

			var noteArr;
			if(Array.isArray(note)) {
				noteArr = note;
			}
			else {
				noteArr = note.split("\n");
			}
			if(noteArr.length > 1) {
				for (const [i, line] of noteArr.entries()) {
					await page.type('#payment-note', line);
					if(i < noteArr.length - 1) {
						await page.keyboard.down('Shift');
						await page.keyboard.press('Enter');
						await page.keyboard.up('Shift');
					}
				}
			}
			else {
				var text = noteArr[0];
				await page.type('#payment-note', text);
			}

			// Send request
			const [requestSpan] = await page.$x('//span[contains(., "Request")]');
			if (requestSpan) {
				await requestSpan.click();
			}
			else {
				await browser.close();
				throw('attempt failed');
			}

			const [finalRequestSpan] = await page.$x('//span[contains(., "Request $")]');
			if (finalRequestSpan) {
				// Comment out if testing
				await finalRequestSpan.click();
			}
			else {
				await browser.close();
				throw('attempt failed');
			}

			await page.waitForTimeout(8000);

			await browser.close();
			return true;
		}
		catch(error) {
			console.log(error);
			attemptCount++;
		}
	}
}

export default {request};