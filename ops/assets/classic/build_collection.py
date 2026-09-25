"""Original AllChess collection, Blender 5.2 / Higgsfield 3D Jutsu.

Run with bpy and the Jutsu artifacts registry available. All dimensions in metres.
The twelve semantic root objects are the runtime asset contract.
"""
import bpy
import math
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, color, roughness=.32, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return mat

ivory = material('Warm ivory ceramic', (.86, .77, .59), .27)
ebony = material('Smoked walnut', (.055, .039, .029), .3)
brass = material('Brushed brass inlay', (.5, .29, .09), .34, .7)
felt = material('Forest felt', (.025, .055, .041), .95)
stone = material('Gallery sandstone', (.27, .3, .28), .85)

def finish(obj, name, mat, parent=None, smooth=True):
    obj.name = name
    obj.data.materials.append(mat)
    if parent: obj.parent = parent
    if smooth:
        for poly in obj.data.polygons: poly.use_smooth = True
    return obj

def lathe(name, profile, mat, parent, segments=32):
    verts = [(r*math.cos(2*math.pi*i/segments), r*math.sin(2*math.pi*i/segments), z)
             for r, z in profile for i in range(segments)]
    faces = []
    for j in range(len(profile)-1):
        for i in range(segments):
            a = j*segments+i; b = j*segments+(i+1)%segments
            faces.append((a, b, b+segments, a+segments))
    faces += [tuple(reversed(range(segments))), tuple((len(profile)-1)*segments+i for i in range(segments))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces); mesh.update()
    obj = bpy.data.objects.new(name, mesh); bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, parent)

def sphere(name, location, radius, mat, parent, scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=location)
    obj = finish(bpy.context.object, name, mat, parent)
    obj.scale = scale
    return obj

def cube(name, location, dimensions, mat, parent=None, bevel=.0005):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = finish(bpy.context.object, name, mat, parent, False)
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new('Soft carved edges', 'BEVEL')
        modifier.width = bevel; modifier.segments = 2
        obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj

def root(name, x, y):
    obj = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(obj)
    # Children use local coordinates; move the root only after construction.
    return obj

names = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn']
for side, y, mat in [('light', -.039, ivory), ('dark', .039, ebony)]:
    for i, code in enumerate(names):
        parent = root(f'{side}_{code}', 0, 0)
        radius = .015 if code in ['king','queen'] else .0135 if code != 'pawn' else .0115
        lathe(f'{code} foot', [(radius*.94,0),(radius,.0018),(radius,.0038),(radius*.94,.005),(radius*.78,.006),(radius*.71,.008)], mat, parent)
        lathe('Brass foot thread', [(radius*.98,.003),(radius*1.004,.0033),(radius*1.004,.0038),(radius*.98,.004)], brass, parent)
        lathe('Felt sole', [(radius*.91,.0001),(radius*.91,.0005)], felt, parent)
        height = {'king':.037,'queen':.035,'bishop':.03,'knight':.017,'rook':.027,'pawn':.019}[code]
        lathe(f'{code} turned stem', [(radius*.72,.007),(radius*.56,.009),(radius*.36,.014),(radius*.31,height-.006),(radius*.43,height-.003),(radius*.64,height-.001),(radius*.64,height),(radius*.5,height+.001)], mat, parent)
        if code == 'king':
            lathe('King collar', [(.0068,.037),(.008,.039),(.0077,.041),(.0043,.044)], mat, parent)
            sphere('King orb', (0,0,.045), .0045, mat, parent)
            cube('King cross upright', (0,0,.054), (.003,.003,.014), mat, parent)
            cube('King cross arms', (0,0,.056), (.011,.003,.003), mat, parent)
        elif code == 'queen':
            lathe('Queen crown bowl', [(.004,.036),(.006,.039),(.009,.044),(.0093,.046),(.008,.047)], mat, parent)
            for j in range(8):
                a = 2*math.pi*j/8
                sphere('Queen crown pearl', (.0083*math.cos(a),.0083*math.sin(a),.0475), .0017, mat, parent)
            sphere('Queen finial', (0,0,.0495), .0032, mat, parent)
        elif code == 'bishop':
            cap = lathe('Bishop mitre', [(.003,.031),(.0057,.033),(.0072,.038),(.0052,.043),(.0014,.048),(.0001,.049)], mat, parent)
            cut = cube('Mitre diagonal cut tool', (0,0,.044), (.023,.002,.018), mat, parent, 0)
            cut.rotation_euler.x = -.52
            modifier = cap.modifiers.new('Open mitre slit', 'BOOLEAN'); modifier.operation = 'DIFFERENCE'; modifier.object = cut
            cut.hide_render = True; cut.hide_viewport = True; cut.display_type = 'WIRE'
            # Bake the slit so its negative space survives the portable GLB export.
            bpy.context.view_layer.objects.active = cap
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            bpy.data.objects.remove(cut, do_unlink=True)
            sphere('Bishop finial', (0,0,.049), .0018, mat, parent)
        elif code == 'knight':
            # A deliberately broad side silhouette with a forward muzzle and two ears.
            profile = [(-.008,.017),(.007,.017),(.006,.028),(.009,.034),(.015,.036),(.015,.041),(.007,.045),(.003,.05),(-.003,.049),(-.009,.04),(-.01,.028)]
            thickness = .0075
            verts = [(x,y,z) for x in [-thickness/2,thickness/2] for y,z in profile]
            n=len(profile); faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
            faces += [(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
            mesh=bpy.data.meshes.new('Horse silhouette');mesh.from_pydata(verts,[],faces);mesh.update()
            horse=bpy.data.objects.new('Sculpted horse head',mesh);bpy.context.collection.objects.link(horse);finish(horse,horse.name,mat,parent,False)
            bevel=horse.modifiers.new('Rounded carving', 'BEVEL');bevel.width=.0012;bevel.segments=3
            horse.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
            for x in [-.0024,.0024]:
                ear=cube('Horse ear',(x,.0005,.050),(.0025,.004,.008),mat,parent,.0007);ear.rotation_euler.x=-.2
            for x in [-.004,.004]: sphere('Horse inset eye',(x,.005,.043),.001,brass,parent)
            for j in range(4): cube('Mane ridge',(0,-.008,.028+j*.0034),(.008,.0028,.002),mat,parent,.0005)
        elif code == 'rook':
            lathe('Rook tower', [(.0068,.027),(.0077,.03),(.0084,.033),(.0084,.036),(.0064,.036),(.0064,.033)], mat, parent)
            for j in range(6):
                a=2*math.pi*j/6
                tooth=cube('Rook crenellation',(.007*math.cos(a),.007*math.sin(a),.038),(.004,.005,.006),mat,parent,.00035)
                tooth.rotation_euler.z=a
        else:
            sphere('Pawn head',(0,0,.025),.0062,mat,parent)
        parent.location=((i-2.5)*.055,y,0)

cube('Gallery plinth',(0,0,-.007),(.352,.155,.014),stone,None,.004)
scene=bpy.context.scene
if scene.world is None: scene.world=bpy.data.worlds.new('Studio ambient')
scene.world.color=(.22,.22,.22)
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1200;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
bpy.ops.object.camera_add(location=(.24,-.4,.265))
camera=bpy.context.object;camera.name='Collection delivery camera'
camera.rotation_euler=(Vector((0,0,.018))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=.43;scene.camera=camera
for name,position,power,size in [('Warm key',(-.22,-.25,.4),9,.18),('Soft fill',(.3,-.03,.24),5,.16),('Rim',(0,.2,.32),8,.12)]:
    bpy.ops.object.light_add(type='POINT',location=position)
    light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shadow_soft_size=size
scene.view_settings.view_transform='Khronos PBR Neutral'
target=artifacts.file(name='classic-collection.png',media_type='image/png')
scene.render.filepath=target.path
bpy.ops.render.render(write_still=True)
target.publish()
result={'collection':'AllChess Classic', 'roots':[f'{side}_{name}' for side in ['light','dark'] for name in names], 'max_height_m':.061, 'square_pitch_m':.053, 'materials':[m.name for m in [ivory,ebony,brass,felt]]}
