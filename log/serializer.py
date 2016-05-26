
class BaseJSONSerializer(object):
    def __init__(self, obj):
        self.obj = obj

class TraceForestMetaSerializer(BaseJSONSerializer):
    def to_json(self):
        traces = {}
        for id, trace in self.obj.traces.items():
            mp = trace.get_first_merge_point()
            mp_meta = { 'scope': 'unknown', 'lineno': -1, 'filename': '' }
            traces[id] = mp_meta
            if mp:
                mp_meta['scope'] = mp.get_scope()
                lineno, filename = mp.get_source_line()
                mp_meta['lineno'] = lineno
                mp_meta['filename'] = filename
        return {
            'resops': self.obj.resops,
            'traces': traces
        }
