import pytest
from selenium import webdriver
import selenium.webdriver as webdriver
import selenium.webdriver.support.ui as ui

from vmlog.test.e2e.test_traces import (query1, query,
        reset_search_criteria, select_trace_entry, _url)

class TestTracesView(object):
    #def test_(self, drivers):
    #    for driver in drivers:
    #        wait = ui.WebDriverWait(driver,10)
    #        driver.get(_url("#/1v1/traces"))
    #        wait.until(lambda d: not query1(d, '#loading_img').is_displayed())
    #        select_trace_entry(driver, wait, "")
