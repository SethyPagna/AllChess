import hashlib
import json
import math
import struct
import sys
import tempfile
import zlib
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'ops/assets/konane'
MASTERS = SOURCE / 'shore'
MODEL = ROOT / 'public/assets/konane/shore.glb'
TEXTURE_SIZE = 512
RUNTIME_SEGMENTS = 96
RUNTIME_RINGS = 42
SCULPT_SEGMENTS = 256
SCULPT_RINGS = 144
CONFIGS = {
    'light': {'seed': 731, 'width': .0366, 'depth': .0350, 'height': .0154,
              'base': (.84, .80, .70), 'roughness': .73, 'pore_count': 42,
              'probes': [(-.0055, .0048, .0013, .00072),
                         (.0041, .0030, .0011, .00065),
                         (-.0038, -.0050, .0012, .00068)]},
    'dark': {'seed': 1907, 'width': .0374, 'depth': .0345, 'height': .0147,
             'base': (.29, .30, .30), 'roughness': .79, 'pore_count': 29,
             'probes': [(-.0058, .0045, .0011, .00065),
                        (.0042, .0035, .0012, .00069),
                        (.0034, -.0058, .0010, .00060)]},
}


def png(path, rgb):
    data = np.clip(np.rint(rgb * 255), 0, 255).astype(np.uint8)
    height, width, channels = data.shape
    rows = []
    for row in data[::-1]:
        delta = row.copy()
        delta[1:] = row[1:] - row[:-1]
        rows.append(b'\x01' + delta.tobytes())
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' +
                     chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2 if channels == 3 else 6, 0, 0, 0)) +
                     chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))


def image_from_array(name, data, directory, color=False):
    path = directory / f'{name}.png'
    png(path, data)
    image = bpy.data.images.load(str(path), check_existing=False)
    image.name = name
    image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    if color:
        # Decode the source before Blender changes the destination encoding.
        image.pixels[0]
        path = directory / f'{name}.jpg'
        image.file_format = 'JPEG'
        image.save(filepath=str(path), quality=90)
        bpy.data.images.remove(image)
        image = bpy.data.images.load(str(path), check_existing=False)
        image.name = name
    image.pack()
    image.filepath = f'//shore-packed/{path.name}'
    return image


def master_outline(side, config):
    path = MASTERS / f'{side}-stone.png'
    master = bpy.data.images.load(str(path), check_existing=False)
    pixels = np.asarray(master.pixels[:], dtype=np.float32).reshape(master.size[1], master.size[0], 4)
    ys, xs = np.nonzero(pixels[:, :, 3] > .8)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    dx, dy = xs - cx, ys - cy
    angle = np.mod(np.arctan2(dy, dx), 2 * math.pi)
    radius = np.zeros(1440, dtype=np.float64)
    np.maximum.at(radius, np.floor(angle * len(radius) / (2 * math.pi)).astype(int), np.hypot(dx, dy))
    spectrum = np.fft.rfft(radius)
    spectrum[10:] = 0
    radius = np.fft.irfft(spectrum, n=len(radius))
    theta = np.arange(len(radius)) * 2 * math.pi / len(radius)
    scale = np.array([config['width'] / np.ptp(radius * np.cos(theta)),
                      config['depth'] / np.ptp(radius * np.sin(theta))])
    master.pack()
    master.use_fake_user = True
    master.filepath = f'//shore/{side}-stone.png'
    return radius, scale, hashlib.sha256(path.read_bytes()).hexdigest()


def pore_specs(config):
    rng = np.random.default_rng(config['seed'])
    pores = [(*probe[:2], probe[2], probe[2] * .82, probe[3], .2) for probe in config['probes']]
    attempts = 0
    while len(pores) < config['pore_count'] and attempts < 5000:
        attempts += 1
        x, y = rng.uniform(-.014, .014, 2)
        if (x / .015) ** 2 + (y / .014) ** 2 > 1:
            continue
        radius = rng.uniform(.0005, .00105)
        if any(math.hypot(x - p[0], y - p[1]) < radius + p[2] * .85 for p in pores):
            continue
        pores.append((x, y, radius, radius * rng.uniform(.65, 1.15),
                      rng.uniform(.00024, .00053), rng.uniform(-math.pi, math.pi)))
    return pores


def surface(u, v, config, outline, pores, relief=True):
    theta, phi = 2 * math.pi * u, math.pi * (1 - v)
    radii, scale, _ = outline
    radius = np.interp(np.mod(theta, 2 * math.pi), np.arange(len(radii) + 1) * 2 * math.pi / len(radii),
                       np.r_[radii, radii[0]])
    sin_phi, cos_phi = np.sin(phi), np.cos(phi)
    x = radius * scale[0] * np.cos(theta) * sin_phi
    y = radius * scale[1] * np.sin(theta) * sin_phi
    bend = np.sin(theta * 2 + config['seed']) * .00020 * sin_phi ** 2
    upper = config['height'] * (.58 + .42 * (1.18 * cos_phi - .18 * cos_phi ** 3))
    lower = config['height'] * .58 * (1 + cos_phi)
    z = np.where(cos_phi >= 0, upper, lower) + bend
    if relief:
        wear = .000075 * (np.sin(x * 570 + y * 330) * np.cos(y * 490 - x * 210))
        z += wear * sin_phi ** 2
        top_weight = np.clip(cos_phi * 5, 0, 1)
        for px, py, rx, ry, depth, angle in pores:
            dx, dy = x - px, y - py
            qx = (dx * math.cos(angle) + dy * math.sin(angle)) / rx
            qy = (dy * math.cos(angle) - dx * math.sin(angle)) / ry
            distance = qx * qx + qy * qy
            z -= depth * np.maximum(1 - distance, 0) ** 1.4 * top_weight
    radial = np.hypot(x, y)
    bowl_clearance = .13 * radial + 14 * radial * radial
    z = np.where(cos_phi < 0, np.maximum(z, bowl_clearance), z)
    return np.stack([x, y, z], axis=-1)


def stone_mesh(name, config, outline, pores, segments, rings, collection):
    upper_rings = round(rings * 2 / 3)
    latitudes = np.r_[np.linspace(1, .5, upper_rings + 1),
                      np.linspace(.5, 0, rings - upper_rings + 1)[1:]]
    u, v = np.meshgrid(np.arange(segments) / segments, latitudes[1:-1])
    vertices = surface(u, v, config, outline, pores).reshape(-1, 3).tolist()
    top, bottom = len(vertices), len(vertices) + 1
    vertices.extend([(0, 0, config['height']), (0, 0, 0)])
    faces, face_uvs = [], []
    for ring in range(rings - 2):
        va, vb = latitudes[ring + 1], latitudes[ring + 2]
        for segment in range(segments):
            a, b = segment / segments, (segment + 1) / segments
            current, following = segment, (segment + 1) % segments
            faces.append((ring * segments + current, (ring + 1) * segments + current,
                          (ring + 1) * segments + following, ring * segments + following))
            face_uvs.append(((a, va), (a, vb), (b, vb), (b, va)))
    for segment in range(segments):
        a, b = segment / segments, (segment + 1) / segments
        following = (segment + 1) % segments
        faces.append((top, segment, following))
        face_uvs.append((((a + b) / 2, 1), (a, latitudes[1]), (b, latitudes[1])))
        offset = (rings - 2) * segments
        faces.append((bottom, offset + following, offset + segment))
        face_uvs.append((((a + b) / 2, 0), (b, latitudes[-2]), (a, latitudes[-2])))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name='Shore UV')
    for polygon, coordinates in zip(mesh.polygons, face_uvs):
        polygon.use_smooth = True
        for loop, coordinate in zip(polygon.loop_indices, coordinates):
            uv.data[loop].uv = coordinate
    stone = bpy.data.objects.new(name, mesh)
    collection.objects.link(stone)
    triangulate = stone.modifiers.new('Portable surface triangulation', 'TRIANGULATE')
    triangulate.quad_method = 'BEAUTY'
    return stone


def object_noise(points, frequency, seed):
    position = points * frequency
    cell = np.floor(position)
    fraction = position - cell
    weight = fraction * fraction * (3 - 2 * fraction)
    result = np.zeros(points.shape[:-1])
    for x in range(2):
        for y in range(2):
            for z in range(2):
                corner = cell + np.array([x, y, z])
                phase = corner[:, :, 0] * 127.1 + corner[:, :, 1] * 311.7 + corner[:, :, 2] * 74.7 + seed
                value = np.mod(np.sin(phase) * 43758.5453123, 1) * 2 - 1
                blend = np.prod(np.where(np.array([x, y, z]), weight, 1 - weight), axis=-1)
                result += value * blend
    return result * 2.2


def unit(vectors):
    return vectors / np.maximum(np.linalg.norm(vectors, axis=-1, keepdims=True), 1e-12)


def surface_normals(points):
    tangent_u = np.roll(points, -1, axis=1) - np.roll(points, 1, axis=1)
    tangent_v = np.gradient(points, axis=0)
    return unit(np.cross(tangent_u, tangent_v))


def low_surface_basis(stone, u, v):
    segments, rings = RUNTIME_SEGMENTS, RUNTIME_RINGS
    stone.data.calc_loop_triangles()
    coordinates = np.array([vertex.co[:] for vertex in stone.data.vertices])
    normals = np.array([vertex.normal[:] for vertex in stone.data.vertices])
    def grid(values):
        top = np.repeat(values[-2][None, None, :], segments, axis=1)
        bottom = np.repeat(values[-1][None, None, :], segments, axis=1)
        return np.concatenate([top, values[:-2].reshape(rings - 1, segments, 3), bottom], axis=0)
    coordinates, normals = grid(coordinates), grid(normals)
    tangents = np.roll(coordinates, -1, axis=1) - np.roll(coordinates, 1, axis=1)
    tangents[0], tangents[-1] = tangents[1], tangents[-2]
    upper_rings = round(rings * 2 / 3)
    latitudes = np.r_[np.linspace(1, .5, upper_rings + 1),
                      np.linspace(.5, 0, rings - upper_rings + 1)[1:]]
    row = np.interp(v[:, 0], latitudes[::-1], np.arange(rings + 1)[::-1])[:, None]
    column = u * segments
    row0, col0 = np.floor(row).astype(int), np.floor(column).astype(int)
    row1, col1 = np.minimum(row0 + 1, rings), (col0 + 1) % segments
    row_mix, col_mix = (row - row0)[:, :, None], (column - col0)[:, :, None]
    def sample(values):
        first = values[row0, col0] * (1 - col_mix) + values[row0, col1] * col_mix
        second = values[row1, col0] * (1 - col_mix) + values[row1, col1] * col_mix
        return first * (1 - row_mix) + second * row_mix
    normal = unit(sample(normals))
    tangent = sample(tangents)
    tangent = unit(tangent - normal * np.sum(tangent * normal, axis=-1, keepdims=True))
    return tangent, unit(np.cross(normal, tangent)), normal


def portable_material(side, config, outline, pores, stone, directory):
    size = TEXTURE_SIZE
    rng = np.random.default_rng(config['seed'] + 73)
    u, v = np.meshgrid((np.arange(size) + .5) / size, (np.arange(size) + .5) / size)
    points = surface(u, v, config, outline, pores, relief=False)
    broad = object_noise(points, 230, config['seed'])
    grain = object_noise(points, 2800, config['seed'] + 3)
    fine = object_noise(points, 5700, config['seed'] + 7)
    streak = object_noise(points, 1150, config['seed'] + 11)
    height = (.000008 if side == 'light' else .000006) * grain + .000003 * fine
    cavities = np.zeros((size, size))
    for _ in range(180 if side == 'light' else 125):
        pu, pv = rng.random(), rng.uniform(.07, .93)
        center = surface(np.array(pu), np.array(pv), config, outline, pores, relief=False)
        radius = rng.uniform(.00013, .00042)
        distance = np.sum((points - center) ** 2, axis=-1) / (radius * radius)
        pit = np.exp(-distance * 1.7)
        height -= pit * rng.uniform(.00007, .00016)
        cavities = np.maximum(cavities, pit)
    for px, py, rx, ry, depth, angle in pores:
        dx, dy = points[:, :, 0] - px, points[:, :, 1] - py
        qx = (dx * math.cos(angle) + dy * math.sin(angle)) / rx
        qy = (dy * math.cos(angle) - dx * math.sin(angle)) / ry
        cavities = np.maximum(cavities, np.exp(-(qx * qx + qy * qy) * 2) * np.clip((v - .5) * 8, 0, 1))
    sculpt = surface(u, v, config, outline, pores)
    detailed_normals = surface_normals(sculpt)
    sculpt += detailed_normals * height[:, :, None]
    detailed_normals = surface_normals(sculpt)
    tangent, bitangent, normal = low_surface_basis(stone, u, v)
    normals = unit(np.stack([np.sum(detailed_normals * axis, axis=-1)
                            for axis in (tangent, bitangent, normal)], axis=-1))
    pigment = .010 * broad + .013 * grain
    mineral = np.clip(streak - .25, 0, 2) * (.014 if side == 'light' else .036)
    color = np.array(config['base'])[None, None, :] + pigment[:, :, None] + mineral[:, :, None]
    color += (np.clip(fine - .7, 0, 2) * (.010 if side == 'light' else .023))[:, :, None]
    color[:, :, 2] -= np.clip(broad + .2, 0, 2) * (.007 if side == 'light' else .002)
    roughness = np.clip(config['roughness'] + .024 * grain + .018 * broad + .045 * cavities, .55, .92)
    orm = np.stack([np.clip(1 - cavities * .42, .58, 1), roughness, np.zeros_like(roughness)], axis=-1)
    orm = orm.reshape(size // 2, 2, size // 2, 2, 3).mean(axis=(1, 3))
    images = {
        'colour': image_from_array(f'Shore {side} mineral colour', color, directory, color=True),
        'normal': image_from_array(f'Shore {side} micro relief', normals * .5 + .5, directory),
        'orm': image_from_array(f'Shore {side} occlusion roughness metal', orm, directory),
    }
    material = bpy.data.materials.new(f'Shore {side} waterworn stone')
    material.use_nodes = True
    material.diffuse_color = (*config['base'], 1)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['IOR'].default_value = 1.46
    shader.inputs['Roughness'].default_value = config['roughness']
    color_node = nodes.new('ShaderNodeTexImage')
    color_node.image = images['colour']
    color_node.location = (-600, 300)
    links.new(color_node.outputs['Color'], shader.inputs['Base Color'])
    normal_node = nodes.new('ShaderNodeTexImage')
    normal_node.image = images['normal']
    normal_node.location = (-600, 0)
    normal_map = nodes.new('ShaderNodeNormalMap')
    normal_map.location = (-270, 0)
    links.new(normal_node.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'], shader.inputs['Normal'])
    orm_node = nodes.new('ShaderNodeTexImage')
    orm_node.image = images['orm']
    orm_node.location = (-600, -300)
    separate = nodes.new('ShaderNodeSeparateColor')
    separate.location = (-270, -300)
    links.new(orm_node.outputs['Color'], separate.inputs['Color'])
    links.new(separate.outputs['Green'], shader.inputs['Roughness'])
    links.new(separate.outputs['Blue'], shader.inputs['Metallic'])
    settings = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    settings.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    occlusion = nodes.new('ShaderNodeGroup')
    occlusion.node_tree = settings
    occlusion.location = (0, -350)
    links.new(separate.outputs['Red'], occlusion.inputs['Occlusion'])
    return material


def studio(roots):
    for index, root in enumerate(roots):
        root.location.x = -.025 if index == 0 else .025
        root.rotation_euler.z = -.20 if index == 0 else .16
        detailed = bpy.data.objects[f'Shore {root.name.split("_")[0]} editable sculpt']
        detailed.location = root.location.copy()
        detailed.rotation_euler = root.rotation_euler.copy()
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -.012))
    plinth = bpy.context.object
    plinth.name = 'Preview support, excluded from GLB'
    plinth.scale = (.112, .074, .024)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = plinth.modifiers.new('Soft display edges', 'BEVEL')
    bevel.width, bevel.segments = .004, 4
    material = bpy.data.materials.new('Preview warm gray')
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.19, .185, .17, 1)
    shader.inputs['Roughness'].default_value = .78
    plinth.data.materials.append(material)
    bpy.ops.object.camera_add(location=(.028, -.093, .134))
    camera = bpy.context.object
    camera.name = 'Shore preview camera'
    camera.data.type, camera.data.ortho_scale = 'ORTHO', .125
    camera.rotation_euler = (Vector((0, 0, .002)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene = bpy.context.scene
    scene.camera = camera
    scene.world = bpy.data.worlds.new('Shore neutral studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.30, .32, .35, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .45
    for name, position, power, size in [('Key', (-.085, -.055, .10), .20, .06),
                                         ('Fill', (.10, -.015, .09), .08, .10),
                                         ('Edge', (0, .10, .12), .14, .075)]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light = bpy.context.object
        light.name = f'Shore preview {name}'
        light.data.energy, light.data.shape, light.data.size = power, 'DISK', size
        light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.threads_mode, scene.render.threads = 'FIXED', 4
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1400, 1000, 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Khronos PBR Neutral'
    scene.render.filepath = str(SOURCE / 'shore-preview.png')
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.type = 'MATERIAL'


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.length_unit = 'MILLIMETERS'
    runtime = bpy.data.collections.new('Shore portable pieces')
    sculpt = bpy.data.collections.new('Shore editable detailed sculpts')
    bpy.context.scene.collection.children.link(runtime)
    bpy.context.scene.collection.children.link(sculpt)
    sculpt.hide_render = True
    sculpt.hide_viewport = True
    roots = []
    with tempfile.TemporaryDirectory(prefix='allchess-shore-') as temporary:
        directory = Path(temporary)
        for side, config in CONFIGS.items():
            outline = master_outline(side, config)
            pores = pore_specs(config)
            root = bpy.data.objects.new(f'{side}_stone', None)
            runtime.objects.link(root)
            root['collection'] = 'Shore'
            root['master_sha256'] = outline[2]
            root['master_relation'] = 'Smoothed alpha silhouette; original sculpted height and pores; procedural PBR interpretation'
            root['modeled_pore_count'] = len(pores)
            root['pore_probes_json'] = json.dumps([{'center': [p[0], config['height'], -p[1]],
                                                   'radius': p[2], 'depth': p[3]} for p in config['probes']])
            root['mount_y'] = -.006
            stone = stone_mesh(f'Shore {side} waterworn surface', config, outline, pores,
                               RUNTIME_SEGMENTS, RUNTIME_RINGS, runtime)
            material = portable_material(side, config, outline, pores, stone, directory)
            stone.parent = root
            stone.data.materials.append(material)
            detailed = stone_mesh(f'Shore {side} editable sculpt', config, outline, pores,
                                  SCULPT_SEGMENTS, SCULPT_RINGS, sculpt)
            detailed.data.materials.append(material)
            detailed['pore_parameters_json'] = json.dumps(pores)
            roots.append(root)
            coordinates = np.array([vertex.co[:] for vertex in stone.data.vertices])
            print('SHORE_GEOMETRY ' + json.dumps({'owner': side, 'vertices': len(coordinates),
                  'triangles': 2 * RUNTIME_SEGMENTS * (RUNTIME_RINGS - 1),
                  'min_xyz': coordinates.min(axis=0).tolist(), 'max_xyz': coordinates.max(axis=0).tolist(),
                  'max_radius': float(np.linalg.norm(coordinates[:, :2], axis=1).max()),
                  'modeled_pores': len(pores), 'master_sha256': outline[2]}), flush=True)
        bpy.ops.object.select_all(action='DESELECT')
        for root in roots:
            root.select_set(True)
            for child in root.children:
                child.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(MODEL), export_format='GLB', use_selection=True,
                                  export_apply=True, export_yup=True, export_extras=True,
                                  export_image_format='AUTO', export_materials='EXPORT')
        if MODEL.stat().st_size > 1.7 * 1024 * 1024:
            raise RuntimeError(f'Shore GLB exceeds 1.7 MiB: {MODEL.stat().st_size} bytes')
        print(f'SHORE_EXPORT {MODEL.stat().st_size} bytes', flush=True)
        studio(roots)
        bpy.context.scene['shore_builder'] = 'ops/assets/konane/build_shore.py'
        bpy.context.scene['shore_texture_method'] = 'Object-space pigments and analytic detailed-sculpt tangent normals; no photographic lighting baked'
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'shore.blend'))
        if '--no-render' not in sys.argv:
            if '--draft' in sys.argv:
                bpy.context.scene.cycles.samples = 12
                bpy.context.scene.render.resolution_percentage = 40
            bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
