"""Original Club draughts counters modeled from individually generated design masters.

Blender 5.2: blender -b -t 4 --python ops/assets/draughts/build_club.py
The lacquer maps are baked from the editable procedural material below. No scanned
wood or third-party geometry is used. Dimensions are in metres.
"""
import bpy
import bmesh
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
SCRATCH = ROOT / 'output/playwright/club-model'
SCRATCH.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'

# Flat underside, rounded foot, two circumferential waist grooves, broad soft
# shoulder, a scooped dish, and a small low central plateau. Every contour is
# modeled rather than represented by an image, a normal map, or a floating ring.
PROFILE = [
    (.01700, .00000), (.01880, .00000), (.01930, .00007),
    (.01980, .00025), (.02028, .00056), (.02065, .00096),
    (.02089, .00139), (.02100, .00180), (.02097, .00212),
    (.02081, .00239), (.02052, .00261), (.02012, .00277),
    (.01972, .00287), (.01946, .00299), (.01938, .00314),
    (.01946, .00329), (.01971, .00340), (.02011, .00351),
    (.02039, .00366), (.02050, .00385), (.02040, .00404),
    (.02011, .00419), (.01971, .00430), (.01946, .00443),
    (.01939, .00459), (.01949, .00477), (.01977, .00494),
    (.02019, .00512), (.02057, .00539), (.02085, .00572),
    (.02098, .00609), (.02098, .00643), (.02084, .00680),
    (.02059, .00717), (.02024, .00749), (.01982, .00774),
    (.01935, .00792), (.01883, .00800), (.01832, .00798),
    (.01786, .00787), (.01743, .00767), (.01703, .00740),
    (.01657, .00708), (.01605, .00673), (.01548, .00639),
    (.01485, .00606), (.01417, .00575), (.01345, .00547),
    (.01269, .00522), (.01191, .00501), (.01112, .00484),
    (.01032, .00470), (.00953, .00461), (.00878, .00454),
    (.00813, .00451), (.00762, .00454), (.00726, .00461),
    (.00702, .00474), (.00681, .00489), (.00658, .00501),
    (.00631, .00508), (.00596, .00511), (.00550, .00512),
    (.00400, .00512), (.00200, .00512), (.00050, .00512)
]
SEGMENTS = 160
WALL_START, TOP_START = 1, 30


def counter_mesh():
    vertices = [(0, 0, 0)]
    for radius, height in PROFILE:
        vertices.extend((radius * math.cos(i * math.tau / SEGMENTS),
                         radius * math.sin(i * math.tau / SEGMENTS), height)
                        for i in range(SEGMENTS + 1))
    top_pole = len(vertices)
    vertices.append((0, 0, PROFILE[-1][1]))
    faces, sections = [], []
    for i in range(SEGMENTS):
        faces.append((0, i + 2, i + 1)); sections.append(-1)
    for j in range(len(PROFILE) - 1):
        for i in range(SEGMENTS):
            a = 1 + j * (SEGMENTS + 1) + i
            faces.append((a, a + 1, a + SEGMENTS + 2, a + SEGMENTS + 1))
            sections.append(j)
    last = 1 + (len(PROFILE) - 1) * (SEGMENTS + 1)
    for i in range(SEGMENTS):
        faces.append((last + i, last + i + 1, top_pole)); sections.append(len(PROFILE))
    mesh = bpy.data.meshes.new('Club continuous rounded counter')
    mesh.from_pydata(vertices, [], faces); mesh.update()
    uv = mesh.uv_layers.new(name='Club surface atlas')
    distances = [0]
    for (r0, z0), (r1, z1) in zip(PROFILE, PROFILE[1:]):
        distances.append(distances[-1] + math.hypot(r1 - r0, z1 - z0))
    for poly, section in zip(mesh.polygons, sections):
        poly.use_smooth = True
        for loop in poly.loop_indices:
            index = mesh.loops[loop].vertex_index
            x, y, _ = vertices[index]
            if section < WALL_START:
                coords = (.25 + x / .021 * .22, .25 + y / .021 * .22)
            elif section >= TOP_START:
                coords = (.75 + x / .021 * .22, .25 + y / .021 * .22)
            else:
                ring, angle = divmod(index - 1, SEGMENTS + 1)
                v = (distances[ring] - distances[WALL_START]) / (distances[TOP_START] - distances[WALL_START])
                coords = (.02 + angle / SEGMENTS * .96, .54 + v * .43)
            uv.data[loop].uv = coords
    # The UV strip needs duplicate coordinates at its seam, but the physical
    # surface must share vertices so its smooth normals remain continuous.
    joined = bmesh.new(); joined.from_mesh(mesh)
    bmesh.ops.remove_doubles(joined, verts=list(joined.verts), dist=1e-7)
    joined.to_mesh(mesh); joined.free(); mesh.update()
    return mesh


def procedural_lacquer(name, colour):
    material = bpy.data.materials.new(name + ' editable lacquer source')
    material.use_nodes = True; material.use_fake_user = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['IOR'].default_value = 1.48
    bsdf.inputs['Coat Weight'].default_value = .08
    bsdf.inputs['Coat Roughness'].default_value = .30
    coord = nodes.new('ShaderNodeTexCoord')
    fine = nodes.new('ShaderNodeTexNoise'); fine.name = 'Fine lacquer orange peel'
    fine.inputs['Scale'].default_value = 8500
    fine.inputs['Detail'].default_value = 2
    fine.inputs['Roughness'].default_value = .68
    links.new(coord.outputs['Object'], fine.inputs['Vector'])
    broad = nodes.new('ShaderNodeTexNoise'); broad.name = 'Subtle hand finished variation'
    broad.inputs['Scale'].default_value = 620
    broad.inputs['Detail'].default_value = 2
    links.new(coord.outputs['Object'], broad.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB'); ramp.name = 'Lacquer colour variation'
    ramp.color_ramp.elements[0].color = tuple(channel * .94 for channel in colour) + (1,)
    ramp.color_ramp.elements[1].color = tuple(channel * 1.04 for channel in colour) + (1,)
    links.new(broad.outputs['Fac'], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    roughness = nodes.new('ShaderNodeMapRange'); roughness.name = 'Satin lacquer roughness'
    roughness.inputs['To Min'].default_value = .31
    roughness.inputs['To Max'].default_value = .43
    links.new(fine.outputs['Fac'], roughness.inputs['Value'])
    links.new(roughness.outputs[0], bsdf.inputs['Roughness'])
    bump = nodes.new('ShaderNodeBump'); bump.name = 'Lacquer microfinish 12 microns'
    bump.inputs['Strength'].default_value = .32
    bump.inputs['Distance'].default_value = .000012
    links.new(fine.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    return material, ramp.outputs['Color'], roughness.outputs[0]


def bake_image(obj, material, label, output=None):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    obj.data.materials.clear(); obj.data.materials.append(material)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    image = bpy.data.images.new(label, width=1024, height=1024, alpha=False)
    if not label.endswith('colour'): image.colorspace_settings.name = 'Non-Color'
    target = nodes.new('ShaderNodeTexImage'); target.image = image; nodes.active = target
    surface = nodes.get('Material Output').inputs['Surface']
    if output is not None:
        emission = nodes.new('ShaderNodeEmission')
        links.new(output, emission.inputs['Color']); links.new(emission.outputs[0], surface)
    bpy.ops.object.bake(type='EMIT' if output is not None else 'NORMAL',
                        normal_space='TANGENT', margin=12)
    if output is not None:
        nodes.remove(emission)
        links.new(nodes.get('Principled BSDF').outputs[0], surface)
    image.filepath_raw = str(SCRATCH / (label + '.png'))
    image.file_format = 'PNG'; image.save(); image.pack()
    nodes.remove(target)
    return image


mesh = counter_mesh()
bake_object = bpy.data.objects.new('Club texture bake counter', mesh)
scene.collection.objects.link(bake_object)
sources = [procedural_lacquer('Club ivory', (.76, .65, .45)),
           procedural_lacquer('Club oxblood', (.285, .008, .025))]
colour_images = [bake_image(bake_object, source[0], name + ' colour', source[1])
                 for name, source in zip(['Club ivory', 'Club oxblood'], sources)]
roughness_image = bake_image(bake_object, sources[0][0], 'Club satin roughness', sources[0][2])
normal_image = bake_image(bake_object, sources[0][0], 'Club lacquer microfinish')
mesh.materials.clear()
bpy.data.objects.remove(bake_object, do_unlink=True)


def baked_lacquer(name, colour_image):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['IOR'].default_value = 1.48
    bsdf.inputs['Coat Weight'].default_value = .08
    bsdf.inputs['Coat Roughness'].default_value = .30
    for image, socket in [(colour_image, 'Base Color'), (roughness_image, 'Roughness')]:
        texture = nodes.new('ShaderNodeTexImage'); texture.image = image
        links.new(texture.outputs['Color'], bsdf.inputs[socket])
    texture = nodes.new('ShaderNodeTexImage'); texture.image = normal_image
    normal = nodes.new('ShaderNodeNormalMap')
    links.new(texture.outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs[0], bsdf.inputs['Normal'])
    return material


roots = []
for side, colour_image in zip(['light', 'dark'], colour_images):
    counter = mesh.copy(); counter.name = f'Club {side} shared counter'
    counter.materials.append(baked_lacquer(f'Club {"ivory" if side == "light" else "oxblood"} satin lacquer', colour_image))
    for king in [False, True]:
        name = f'{side}_{"king" if king else "man"}'
        root = bpy.data.objects.new(name, None); scene.collection.objects.link(root)
        root['collection'] = 'Club'; root['diameter_mm'] = 42
        root['counter_height_mm'] = 8; root['tier_separation_mm'] = 8.2
        roots.append(root)
        for tier in range(2 if king else 1):
            obj = bpy.data.objects.new(f'{name} counter {tier + 1}', counter)
            scene.collection.objects.link(obj); obj.parent = root
            obj.location.z = tier * .0082
        root.location = ((len(roots) - 2.5) * .056, 0, 0)

bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for child in root.children: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/assets/draughts/club.glb'),
                          export_format='GLB', use_selection=True, export_yup=True,
                          export_extras=True)

scene.world = bpy.data.worlds.new('Club studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.8, .85, 1, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .18
for name, position, power, size in [('Key', (-.12, -.12, .22), 1.2, .09),
                                     ('Fill', (.2, -.05, .12), .35, .15),
                                     ('Rim', (.16, .10, .14), .65, .07)]:
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power
    data.shape = 'DISK'; data.size = size
    obj = bpy.data.objects.new(name, data); scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, .01)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
data = bpy.data.cameras.new('Club collection camera')
camera = bpy.data.objects.new(data.name, data); scene.collection.objects.link(camera)
scene.camera = camera; data.type = 'ORTHO'; data.ortho_scale = .244
camera.location = (.013, -.19, .21)
camera.rotation_euler = (Vector((0, 0, .007)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x = 1600; scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'ops/assets/draughts/club.blend'))
scene.render.filepath = str(ROOT / 'ops/assets/draughts/club-preview.png')
bpy.ops.render.render(write_still=True)
camera.location = (.013, -.23, .065)
camera.rotation_euler = (Vector((0, 0, .007)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(SCRATCH / 'collection-low-angle.png')
bpy.ops.render.render(write_still=True)
print('CLUB_COMPLETE', len(roots))
