import math

def g(x):
    return math.floor(math.sqrt(x))

def f():
    for i in range(2000):
        g(i)

f()
