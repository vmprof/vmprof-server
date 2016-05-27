import pytest
from selenium import webdriver
import selenium.webdriver as webdriver
import selenium.webdriver.support.ui as ui

@pytest.fixture(scope="session")
def drivers(request):
    drivers = [webdriver.Chrome()]
    for b in drivers:
        request.addfinalizer(b.quit)
    return drivers

def _url(path):
    host = "http://localhost:8000"
    if path[0] == "/":
        return host + path
    return host + "/" + path

class TestTracesView(object):
    def test_display_schedule(self, drivers):
        for driver in drivers:
            wait = ui.WebDriverWait(driver,10)
            driver.get(_url("#/1111/traces"))
            wait.until(lambda d: d.find_element_by_id('forest').get_attribute('status') == 'false')
            for elem in driver.find_elements_by_css_selector('li.trace-entry span.trace-name'):
                if 'schedule' in elem.text:
                    break
            else:
                pytest.fail("could not find 'schedule' function in trace view")

    def test_filter_checkboxes(self, drivers):
        for driver in drivers:
            wait = ui.WebDriverWait(driver,10)
            driver.get(_url("#/1111/traces"))
            wait.until(lambda d: d.find_element_by_id('forest').get_attribute('status') == 'false')
            for elem in driver.find_elements_by_css_selector('li.trace-entry span.trace-name'):
                if 'schedule' in elem.text:
                    break
            else:
                pytest.fail("could not find 'schedule' function in trace view")


            count = len(driver.find_elements_by_css_selector('li.trace-entry'))

            bridge_checkbox = driver.find_element_by_id("filter_bridge")
            bridge_checkbox.click() # it is now on

            # there must be more bridges filtered
            assert count < len(driver.find_elements_by_css_selector('li.trace-entry'))

            bridge_checkbox.click() # it is now off
            loop_checkbox = driver.find_element_by_id("filter_loop")
            loop_checkbox.click() # do now show loops!

            assert len(driver.find_elements_by_css_selector('li.trace-entry')) == 0
            loop_checkbox.click() # reset to default

    def test_search_traces(self, drivers):
        for driver in drivers:
            wait = ui.WebDriverWait(driver,10)
            driver.get(_url("#/1111/traces"))
            wait.until(lambda d: d.find_element_by_id('forest').get_attribute('status') == 'false')
            search_input = driver.find_element_by_id("filter_text")
            search_input.send_keys("schedule")
            assert len(driver.find_elements_by_css_selector('li.trace-entry')) == 1

