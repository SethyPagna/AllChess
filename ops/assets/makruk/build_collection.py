"""Original Thai-inspired Makruk set. Blender 5.2, metres; no external assets.

blender --background --python ops/assets/makruk/build_collection.py
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

repo = Path(__file__).resolve().parents[3]
output = repo / 'public/assets/makruk'
output.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name, colour, roughness=.34, metal=0):
    mat=bpy.data.materials.new(name); mat.diffuse_color=(*colour,1); mat.use_nodes=True
    shader=mat.node_tree.nodes.get('Principled BSDF'); shader.inputs['Base Color'].default_value=(*colour,1)
    shader.inputs['Roughness'].default_value=roughness; shader.inputs['Metallic'].default_value=metal
    shader.inputs['Coat Weight'].default_value=.3
    return mat

ivory=material('Warm ivory',(.79,.64,.40))
lacquer=material('Oxblood lacquer',(.15,.014,.009))
inlay=material('Brass inlay',(.49,.30,.08),.35,.65)
eye=material('Dark eye inlay',(.012,.008,.006),.6)
plinth=material('Gallery teak',(.035,.022,.015),.5)
roots=[]

def mesh_object(name, verts, faces, mat, parent):
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update(); mesh.materials.append(mat)
    uv=mesh.uv_layers.new(name='Grain UV')
    for polygon in mesh.polygons:
        for i in polygon.loop_indices:
            v=mesh.vertices[mesh.loops[i].vertex_index].co
            uv.data[i].uv=(v.x/.04+.5,v.z/.06)
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); obj.parent=parent
    return obj

def lathe(name, profile, mat, parent, caps=True):
    n=48
    verts=[(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z) for r,z in profile for i in range(n)]
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
    if caps: faces.extend([tuple(reversed(range(n))),tuple((len(profile)-1)*n+i for i in range(n))])
    obj=mesh_object(name,verts,faces,mat,parent)
    for polygon in obj.data.polygons[:(len(profile)-1)*n]: polygon.use_smooth=True
    return obj

def band(parent,r,z):
    lathe('Fine brass inlay',[(r,z),(r+.00015,z),(r+.00015,z+.0005),(r,z+.0005),(r,z)],inlay,parent,False)

base=[(.015,0),(.018,.001),(.019,.003),(.019,.004),(.017,.006),(.014,.007)]
profiles={
    'khun':base+[(.014,.010),(.017,.012),(.017,.014),(.014,.016),(.010,.020),(.008,.027),(.012,.029),(.012,.031),(.009,.033),(.010,.035),(.009,.038),(.006,.042),(.007,.044),(.005,.046),(.003,.051),(.0007,.056)],
    'met':[(.013,0),(.017,.002),(.017,.005),(.014,.008),(.010,.010),(.010,.013),(.008,.018),(.004,.024),(.0007,.029)],
    'khon':base+[(.013,.010),(.011,.014),(.010,.017),(.014,.020),(.015,.024),(.013,.029),(.009,.034),(.005,.037),(.002,.044),(.0007,.046)],
    # Ruea is the traditional turned, inverted-bell rook, without castle battlements.
    'ruea':[(.014,0),(.018,.002),(.018,.005),(.015,.008),(.013,.013),(.014,.019),(.018,.023),(.020,.025),(.020,.028),(.017,.030),(.013,.030),(.013,.027),(.010,.025),(.0001,.025)],
    'bia':[(.013,0),(.017,.001),(.018,.003),(.018,.006),(.016,.008),(.012,.010),(.0001,.010)],
    # The same counter turned over: recessed face up, with a concentric inset.
    'promoted_bia':[(.012,0),(.016,.002),(.018,.004),(.018,.007),(.017,.009),(.013,.010),(.011,.010),(.011,.007),(.0001,.007)]
}

def horse(parent,mat):
    lathe('Ma turned base',base+[(.013,.010),(.012,.012)],mat,parent)
    outline=[(-.013,.010),(-.013,.025),(-.011,.040),(-.005,.053),(.000,.058),(.001,.067),(.007,.061),(.010,.057),(.017,.050),(.021,.046),(.019,.039),(.011,.040),(.005,.045),(.003,.036),(.008,.025),(.012,.010)]
    verts=[(x,y,z) for x in [-.007,.007] for y,z in outline]; n=len(outline)
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj=mesh_object('Ma carved horse',verts,faces,mat,parent)
    bevel=obj.modifiers.new('Handled edges','BEVEL'); bevel.width=.0013; bevel.segments=3
    obj.modifiers.new('Face normals','WEIGHTED_NORMAL')
    for x in [-.0075,.0075]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.0012,location=(x,.008,.053))
        obj=bpy.context.object; obj.name='Ma eye inlay'; obj.parent=parent; obj.data.materials.append(eye)

names=['khun','met','khon','ma','ruea','bia','promoted_bia']
for side in ['light','dark']:
    mat=ivory if side=='light' else lacquer
    for index,name in enumerate(names):
        parent=bpy.data.objects.new(f'{side}_{name}',None); bpy.context.collection.objects.link(parent); roots.append(parent)
        if name=='ma': horse(parent,mat)
        else: lathe(name,profiles[name],mat,parent)
        if name not in ['bia','promoted_bia']: band(parent,.017,.0042)
        elif name=='promoted_bia': band(parent,.0108,.0072)
        if name=="ma": parent.rotation_euler.z=math.pi/4
        parent.location=((index-3)*.054, -.043 if side=='light' else .043,0)

bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,-.012));obj=bpy.context.object;obj.name='Delivery plinth';obj.scale=(.405,.15,.02)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.data.materials.append(plinth)
bevel=obj.modifiers.new('Soft edge','BEVEL');bevel.width=.004;bevel.segments=3
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1200;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
if not scene.world: scene.world=bpy.data.worlds.new('Gallery ambient')
scene.world.color=(.16,.16,.16)
bpy.ops.object.camera_add(location=(.10,-.40,.34));camera=bpy.context.object;camera.name='Collection delivery camera';camera.data.type='ORTHO';camera.data.ortho_scale=.46
camera.rotation_euler=(Vector((0,0,.018))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera
for name,position,power,size in [('Key',(-.2,-.2,.4),12,.18),('Fill',(.3,-.1,.3),7,.16),('Rim',(.1,.3,.3),14,.10)]:
    bpy.ops.object.light_add(type='POINT',location=position);obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.shadow_soft_size=size
scene.view_settings.view_transform='Khronos PBR Neutral'
bpy.ops.wm.save_as_mainfile(filepath=str(repo/'ops/assets/makruk/collection.blend'))
bpy.ops.object.select_all(action='DESELECT')
for parent in roots:
    parent.select_set(True)
    for child in parent.children: child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(output/'collection.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
scene.render.filepath=str(output/'collection.png');bpy.ops.render.render(write_still=True)
print('Exported Makruk with',len(roots),'semantic roots')
