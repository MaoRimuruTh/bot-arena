# Blender (bpy 5.3): "ช้างน้อย", the first 3D table avatar: a chibi baby elephant with a red saddle cloth and a gold chada crown.
# An original design. Built from rounded parts hung on named pivots (body, head, ear.L, ear.R, trunk, tail) like a Blockbench model,
# so anim.mjs can add the idle / hit / win / lose clips by node name. It faces Blender -Y, which is +Z in glTF and in the game.
import bpy, math, os
from mathutils import Vector, Matrix, Euler

OUT = os.environ.get("OUT", os.getcwd())
bpy.ops.wm.read_factory_settings(use_empty=True)
col = bpy.context.collection

def mat(name, base, metal=0.0, rough=0.55):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Metallic"].default_value = metal; b.inputs["Roughness"].default_value = rough
    return m
SKIN = mat("skin", (0.62, 0.60, 0.74), 0, 0.62)
PINK = mat("pink", (0.95, 0.58, 0.66), 0, 0.6)
EYE = mat("eye", (0.02, 0.015, 0.03), 0, 0.12)
SHINE = mat("shine", (1, 1, 1), 0, 0.3)
RED = mat("cloth", (0.60, 0.035, 0.05), 0, 0.5)
GOLD = mat("gold", (0.93, 0.68, 0.26), 1, 0.3)
NAIL = mat("nail", (0.96, 0.92, 0.82), 0, 0.4)

def pivot(name, at, parent=None):
    e = bpy.data.objects.new(name, None); e.empty_display_size = 0.1; col.objects.link(e); e.location = at
    if parent: e.parent = parent; e.matrix_parent_inverse = parent.matrix_world.inverted()
    bpy.context.view_layer.update(); return e

def ball(name, at, rad, m, parent, rot=(0, 0, 0), seg=(16, 10)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg[0], ring_count=seg[1], radius=1, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = rad; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o

def tube(name, at, r, depth, m, parent, rot=(0, 0, 0), seg=14):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=at, rotation=rot)
    o = bpy.context.object; o.name = name; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    bpy.context.view_layer.update(); o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o

root = pivot("root", (0, 0, 0))
body = pivot("body", (0, 0, 0.30), root)
head = pivot("head", (0, -0.14, 0.78), body)
earL = pivot("ear.L", (0.27, -0.12, 1.02), head)
earR = pivot("ear.R", (-0.27, -0.12, 1.02), head)
trunk = pivot("trunk", (0, -0.47, 0.93), head)
tail = pivot("tail", (0, 0.40, 0.50), body)

# body, legs and toenails
ball("belly", (0, 0.04, 0.47), (0.40, 0.44, 0.36), SKIN, body)
for i, (x, y) in enumerate([(0.2, -0.17), (-0.2, -0.17), (0.2, 0.24), (-0.2, 0.24)]):
    tube(f"leg{i}", (x, y, 0.15), 0.105, 0.26, SKIN, root)
    ball(f"foot{i}", (x, y, 0.035), (0.115, 0.115, 0.045), SKIN, root, seg=(12, 6))
    for k in (-1, 0, 1):
        ball(f"nail{i}{k}", (x + k * 0.045, y - 0.1, 0.04), (0.026, 0.02, 0.022), NAIL, root, seg=(8, 5))
# saddle cloth with a gold rim, and a tassel
ball("cloth", (0, 0.06, 0.79), (0.35, 0.31, 0.075), RED, body)
ball("cloth_rim", (0, 0.06, 0.765), (0.365, 0.325, 0.03), GOLD, body, seg=(20, 6))
ball("tassel", (0.0, 0.06, 0.88), (0.05, 0.05, 0.05), GOLD, body, seg=(10, 6))
# head: big and round, eyes with a glint, pink cheeks
ball("skull", (0, -0.2, 1.0), (0.36, 0.34, 0.33), SKIN, head)
for s in (1, -1):
    ball(f"eye{s}", (s * 0.13, -0.5, 1.07), (0.055, 0.04, 0.062), EYE, head, seg=(12, 8))
    ball(f"glint{s}", (s * 0.115, -0.535, 1.095), (0.018, 0.01, 0.018), SHINE, head, seg=(8, 5))
    ball(f"cheek{s}", (s * 0.2, -0.47, 0.93), (0.065, 0.02, 0.04), PINK, head, seg=(10, 6))
# ears: wide and flat, pink inside, each on its own pivot so they can flap
for e, s in ((earL, 1), (earR, -1)):
    ball(f"ear{s}", (s * 0.44, -0.1, 1.0), (0.24, 0.04, 0.23), SKIN, e, rot=(0, 0, s * 0.35))
    ball(f"earin{s}", (s * 0.44, -0.135, 1.0), (0.17, 0.02, 0.165), PINK, e, rot=(0, 0, s * 0.35))
# trunk: a chain of rounded pieces curling forward at the tip
KEYS = [(-0.5, 0.9, 0.095), (-0.56, 0.82, 0.085), (-0.6, 0.73, 0.075), (-0.63, 0.65, 0.066), (-0.68, 0.6, 0.058), (-0.73, 0.62, 0.05)]
for k in range(16):  # many overlapping pieces along the curve, so it reads as one smooth trunk
    t = k / 15 * (len(KEYS) - 1); i = min(int(t), len(KEYS) - 2); f = t - i; a, b = KEYS[i], KEYS[i + 1]
    y, z, r = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f)
    ball(f"trunk{k}", (0, y, z), (r, r, r), SKIN, trunk, seg=(12, 8))
ball("trunk_tip", (0, -0.765, 0.645), (0.045, 0.03, 0.045), PINK, trunk, seg=(10, 6))
# the chada crown: a gold spire on stacked rings
for k, (z, r) in enumerate([(1.31, 0.11), (1.36, 0.09), (1.41, 0.07)]):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.022, major_segments=18, minor_segments=6, location=(0, -0.16, z))
    o = bpy.context.object; o.name = f"ring{k}"; bpy.ops.object.shade_smooth(); o.data.materials.append(GOLD); o.parent = head; o.matrix_parent_inverse = head.matrix_world.inverted()
bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.07, radius2=0.0, depth=0.26, location=(0, -0.16, 1.55))
o = bpy.context.object; o.name = "spire"; bpy.ops.object.shade_smooth(); o.data.materials.append(GOLD); o.parent = head; o.matrix_parent_inverse = head.matrix_world.inverted()
ball("jewel", (0, -0.27, 1.33), (0.035, 0.02, 0.045), RED, head, seg=(8, 6))
# tail with a tuft
tube("tail_rope", (0, 0.47, 0.42), 0.022, 0.2, SKIN, tail, rot=(0.6, 0, 0), seg=8)
ball("tuft", (0, 0.52, 0.33), (0.05, 0.05, 0.07), EYE, tail, seg=(10, 6))

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "chang_raw.glb"), export_format="GLB", export_yup=True, export_apply=True, export_texcoords=False, export_animations=False)
print("faces", sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH"))
