import base64
from collections import defaultdict

from jitlog.objects import MergePoint
from jitlog import constants as const

class BaseSerializer(object):
    pass

class BadRequest(Exception):
    pass

class LogMetaSerializer(BaseSerializer):
    def to_representation(self, forest):
        # construct json
        traces = {}
        links = {}
        labels = defaultdict(list)
        jumps = defaultdict(list)
        for id, trace in forest.traces.items():
            mp = trace.get_first_merge_point()
            counter_points = trace.get_counter_points()
            mp_meta = { 'scope': 'unknown', 'lineno': -1, 'filename': '',
                        'type': trace.type, 'counter_points': counter_points }
            if trace.is_assembled():
                mp_meta['addr'] = trace.get_addrs()
            mp_meta['jd_name'] = trace.jd_name
            traces[id] = mp_meta
            if mp:
                mp_meta['scope'] = mp.get_scope()
                lineno, filename = mp.get_source_line()
                mp_meta['lineno'] = lineno
                mp_meta['filename'] = filename
            par = trace.get_parent()
            if par:
                mp_meta['parent'] = hex(par.unique_id)
            mp_meta['stamp'] = trace.stamp
            # serialize all trace connections
            links[id] = idxtoid = {}
            for link in trace.links:
                origop = link.origin.op
                target = link.target.trace
                # save op.index -> trace_id
                if origop is None:
                    idxtoid[0] = target.get_id()
                else:
                    idxtoid[origop.getindex()] = target.get_id()
            if len(links[id]) == 0:
                del links[id]
        #for descr_number, pointintrace in forest.labels.items():
        #    op = pointintrace.get_operation()
        #    labels[descr_number].append([pointintrace.trace.get_id(), op.getindex()])
        #for descr_number, pointintrace in forest.jumps.items():
        #    op = pointintrace.get_operation()
        #    jumps[descr_number].append([pointintrace.trace.get_id(), op.getindex()])
        return {
            'resops': forest.resops,
            'traces': traces,
            'links': links,
            'word_size': forest.word_size,
            'machine': forest.machine,
        }


class OperationSerializer(BaseSerializer):
    def to_representation(self, op):
        if isinstance(op, MergePoint):
            mp_dict = {'i': op.getindex()}
            for sem_type, value in op.values.items():
                name = const.SEM_TYPE_NAMES[sem_type]
                mp_dict[name] = value
            return mp_dict
        else:
            dict = { 'num': op.opnum, 'i': op.index }
            if op.args: dict['args'] = op.args
            if op.result: dict['res'] = op.result
            if op.descr: dict['descr'] = op.descr
            if op.core_dump:
                dump = base64.b64encode(op.core_dump[1])
                dict['dump'] = dump.decode('utf-8')
            if op.descr_number:
                dict['descr_number'] = hex(op.descr_number)
            return dict


class StageSerializer(BaseSerializer):
    def to_representation(self, stage):
        op_serializer = OperationSerializer()
        ops = []
        # merge points is a dict mapping from index -> merge_points
        stage_dict = { 'ops': ops }
        source_code = {}
        for i,op in enumerate(stage.get_ops()):
            op_stage_dict = op_serializer.to_representation(op)
            ops.append(op_stage_dict)
        #
        stage_dict['merge_points'] = merge_points = []
        # fast access for the first debug merge point!
        for i,mp in enumerate(stage.get_merge_points()):
            assert mp.is_debug()
            mpdict = op_serializer.to_representation(mp)
            merge_points.append(mpdict)
        #
        return stage_dict

class TraceSerializer(BaseSerializer):
    def to_representation(self, trace):
        stages = {}
        source_code = {}
        dict = { 'args': trace.inputargs,
                 'stages': stages,
                 'code': source_code
               }

        stage_serializer = StageSerializer()
        for markname, stage in trace.stages.items():
            stage_dict = stage_serializer.to_representation(stage)
            stages[markname] = stage_dict

            merge_points = stage_dict.get('merge_points', None)
            if merge_points:
                for i, mp in enumerate(merge_points):
                    if 'filename' in mp and 'lineno' in mp:
                        # both filename and line number is known, try to extract it from the uploaded data
                        filename = mp['filename']
                        lineno = mp['lineno']
                        indent, line = trace.forest.get_source_line(filename, lineno)
                        if line:
                            if filename not in source_code:
                                source_code[filename] = {}
                            lines = source_code[filename]
                            lines[lineno] = (indent, line)
        if trace.is_bridge():
            op = trace.get_failing_guard()
            if op:
                op_serializer = OperationSerializer()
                dict['failing_guard'] = op_serializer.to_representation(op)
        #
        if trace.addrs != (-1,-1):
            dict['addr'] = (hex(trace.addrs[0]), hex(trace.addrs[1]))
        return dict


class VisualTraceTreeSerializer(BaseSerializer):
    def to_representation(self, trace):
        stitches = {}
        errors = []
        d = { 'root': hex(trace.unique_id),
              'stitches': stitches,
            }

        worklist = [trace]
        while worklist:
            trace = worklist.pop()
            hex_unique_id = hex(trace.unique_id)
            stage = trace.get_stage('asm')
            if not stage:
                continue
            oplist = []
            for i,op in enumerate(stage.get_ops()):
                descr_nmr = hex(op.get_descr_nmr() or 0)
                if op.is_guard():
                    target = trace.forest.get_stitch_target(op.get_descr_nmr())
                    if target:
                        to_trace = trace.forest.get_trace_by_id(target)
                        if to_trace:
                            worklist.append(to_trace)
                            target = hex(to_trace.unique_id)
                        else:
                            errors.append("No 'asm' stage of trace (0x%x)" % target)
                            target = '0x0'
                    else:
                        target = '0x0'
                    oplist.append(','.join(['g',str(i), descr_nmr, target]))
                if op.opname == "label":
                    oplist.append(','.join(['l',str(i), descr_nmr]))
                if op.opname == "jump":
                    oplist.append(','.join(['j',str(i), descr_nmr]))
                if op.opname == "finish":
                    oplist.append(','.join(['f',str(i), descr_nmr]))
            stitches[hex(trace.unique_id)] = oplist
        if errors:
            d['errors'] = errors
        return d

