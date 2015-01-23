

def serialize(name):
    segments = name.split(":")

    return name, {
        "id": name,
        "file": segments[1],
        "name": segments[2],
        "line": segments[3],
    }


def get_head(profiles):

    top_functions = {}
    for profile in profiles:
        current_iter = {}
        for name in profile[0]:
            if name not in current_iter:
                top_functions[name] = top_functions.get(name, 0) + 1
                current_iter[name] = None

    top_items = top_functions.items()
    top_items.sort(key=lambda i: -i[1])
    total = len(profiles)

    functions = {}
    top = []
    top_calls = []

    for name, count in top_items:
        name, profile = serialize(name)

        functions[name] = profile
        top.append(name)
        top_calls.append((name, int(float(count) / total * 100)))

    return top, top_calls, functions


def get_calls(profiles, head_calls):

    functions = {}

    for key in head_calls:

        result = {}
        total = 0
        for profile in profiles:
            current_iter = {}  # don't count twice
            counting = False
            for name in profile[0]:
                if counting:
                    if name in current_iter:
                        continue
                    current_iter[name] = None
                    result[name] = result.get(name, 0) + 1
                else:
                    if name == key:
                        counting = True
                        total += 1

        items = result.items()
        items.sort(key=lambda i: -i[1])

        functions[key] = []

        for name, count in items:
            functions[key].append(
                (name, int(float(count) / total * 100))
            )

    return functions


def process(raw_data):

    profiles = raw_data['profiles']
    raw_addresses = raw_data['addresses']

    addresses = {}
    for k, v in raw_addresses.iteritems():
        addresses[int(k)] = v
    for profile in profiles:
        cur = []
        for item in profile[0]:
            cur.append(addresses[item])
        profile[0] = cur

    top, top_calls, _profiles = get_head(profiles)
    calls = get_calls(profiles, top)

    data = {
        "head": top_calls,
        "profiles": _profiles,
        "calls": calls
    }

    return data
