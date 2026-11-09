import onnx, numpy as np, sys
from onnx import numpy_helper, helper, TensorProto
src, dst = sys.argv[1], sys.argv[2]
m = onnx.load(src)
g = m.graph
new_inits, casts, n = [], [], 0
for init in g.initializer:
    if init.data_type == TensorProto.FLOAT and np.prod(init.dims) >= 256:
        arr = numpy_helper.to_array(init)
        h = numpy_helper.from_array(arr.astype(np.float16), init.name + '__f16')
        new_inits.append(h)
        casts.append(helper.make_node('Cast', [init.name + '__f16'], [init.name], to=TensorProto.FLOAT, name='cast_' + init.name))
        n += 1
    else:
        new_inits.append(init)
del g.initializer[:]
g.initializer.extend(new_inits)
nodes = list(g.node)
del g.node[:]
g.node.extend(casts + nodes)
onnx.save(m, dst)
print('converted', n)
