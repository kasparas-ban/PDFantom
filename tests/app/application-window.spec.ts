import { expect, test } from "./test"

test("the test application uses its configured window visibility after relaunch", async ({
  application,
}) => {
  const expectedVisibility = application.windowMode === "visible"

  expect(await application.hasVisibleWindow()).toBe(expectedVisibility)
  await application.relaunch()
  expect(await application.hasVisibleWindow()).toBe(expectedVisibility)
})
