"""Original rosette draughts geometry, based on individually generated design masters.
Blender 5.2: blender -b -t 4 --python ops/assets/draughts/build_rosette.py
CC0 wood scan provenance: ops/assets/materials/README.md.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

R=Path(__file__).resolve().parents[3]
OUT=R/'output/playwright/rosette';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'

source=bpy.data.images.load(str(R/'public/assets/materials/wood-table/colour.jpg'))
normal=bpy.data.images.load(str(R/'public/assets/materials/wood-table/normal.jpg'));normal.colorspace_settings.name='Non-Color';normal.pack()
rough=bpy.data.images.load(str(R/'public/assets/materials/wood-table/roughness.jpg'));rough.colorspace_settings.name='Non-Color';rough.pack()

# The scan includes polished areas; remap them to a consistent satin wax finish
# and bake the result so glTF receives the same material as Blender.
rm=bpy.data.materials.new('Satin roughness bake');rm.use_nodes=True
nn=rm.node_tree.nodes;ll=rm.node_tree.links
rt=nn.new('ShaderNodeTexImage');rt.image=rough
mapping=nn.new('ShaderNodeMapRange');mapping.inputs['To Min'].default_value=.48;mapping.inputs['To Max'].default_value=.68;ll.new(rt.outputs['Color'],mapping.inputs['Value'])
em=nn.new('ShaderNodeEmission');ll.new(mapping.outputs[0],em.inputs['Color']);ll.new(em.outputs[0],nn.get('Material Output').inputs['Surface'])
satin=bpy.data.images.new('Satin wood roughness',width=1024,height=1024,alpha=False);satin.colorspace_settings.name='Non-Color'
dest=nn.new('ShaderNodeTexImage');dest.image=satin;nn.active=dest
bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.data.materials.append(rm);bpy.ops.object.bake(type='EMIT')
satin.filepath_raw=str(OUT/'satin-roughness.png');satin.file_format='PNG';satin.save();satin.pack();bpy.data.objects.remove(plane,do_unlink=True)
rough=satin

def wood(name,low,high):
    m=bpy.data.materials.new(name);m.use_nodes=True;nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
    p.inputs['Roughness'].default_value=.55;p.inputs['Coat Weight'].default_value=.025
    tex=nodes.new('ShaderNodeTexImage');tex.image=source
    grey=nodes.new('ShaderNodeRGBToBW');links.new(tex.outputs['Color'],grey.inputs[0])
    ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.01;ramp.color_ramp.elements[0].color=(*low,1)
    ramp.color_ramp.elements[1].position=.14;ramp.color_ramp.elements[1].color=(*high,1);links.new(grey.outputs[0],ramp.inputs[0])
    emit=nodes.new('ShaderNodeEmission');links.new(ramp.outputs['Color'],emit.inputs['Color']);links.new(emit.outputs[0],nodes.get('Material Output').inputs['Surface'])
    baked=bpy.data.images.new(name+' colour',width=1024,height=1024,alpha=False)
    target=nodes.new('ShaderNodeTexImage');target.image=baked;nodes.active=target
    bpy.ops.mesh.primitive_plane_add(size=2);plane=bpy.context.object;plane.data.materials.append(m);bpy.ops.object.bake(type='EMIT')
    baked.filepath_raw=str(OUT/(name+'.png'));baked.file_format='PNG';baked.save();baked.pack();bpy.data.objects.remove(plane,do_unlink=True)
    for n in [tex,grey,ramp,emit]:nodes.remove(n)
    links.new(target.outputs['Color'],p.inputs['Base Color']);links.new(p.outputs[0],nodes.get('Material Output').inputs['Surface'])
    t=nodes.new('ShaderNodeTexImage');t.image=normal
    nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.12;links.new(t.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs[0],p.inputs['Normal'])
    t=nodes.new('ShaderNodeTexImage');t.image=rough;links.new(t.outputs['Color'],p.inputs['Roughness'])
    return m

woods=[wood('Rosette boxwood',(.26,.12,.035),(.69,.46,.24)),wood('Rosette walnut',(.020,.006,.002),(.115,.045,.020))]
SEG=192

def make_counter(name,mat,parent,z_offset):
    # Continuous radial profile: underside, reeded side, shoulder, two cut rings,
    # recessed rosette field, and central boss. Each ring has its own true depth.
    profile=[(.0001,0),(.0184,0),(.0192,.0003),(.0198,.0010),(.020,.0016),(.020,.0022),(.020,.0030),(.020,.0045),(.020,.0060),(.020,.0068),(.0199,.0075),(.0196,.0081),(.0191,.0086),(.0184,.0089),(.0179,.009),(.01765,.0084),(.0173,.0083),(.01705,.009),(.0165,.009),(.01625,.0084),(.0159,.0083),(.01565,.009)]
    # A radial surface, not overlay petals: shallow cusped channels define twelve
    # raised petals. The flutes fade into the rim and the central circular boss.
    profile += [(.0155*(1-j/40),.009) for j in range(41)]
    verts=[];uvs=[]
    for idx,(radius,height) in enumerate(profile):
        for i in range(SEG+1):
            angle=i*math.tau/SEG;r=radius;z=height
            if 4<=idx<=10:
                fade=math.sin(math.pi*max(0,min(1,(height-.0016)/.0059)))
                r-=.00045*(.5+.5*math.cos(48*angle))**3*fade
            if idx>=22 and .0033<radius<.0155:
                radial=math.sin(math.pi*(radius-.0033)/(.0155-.0033))**.5
                channel=(.5+.5*math.cos(12*angle))**5
                z-=.00175*radial*channel
                z-=.00055*math.exp(-((radius-.0038)/.0005)**2)
            verts.append((r*math.cos(angle),r*math.sin(angle),z+z_offset))
            uvs.append((.5+r*math.cos(angle)/.044,.5+r*math.sin(angle)/.044+height/.12 if idx<12 else .5+r*math.sin(angle)/.044))
    faces=[(j*(SEG+1)+i,j*(SEG+1)+i+1,(j+1)*(SEG+1)+i+1,(j+1)*(SEG+1)+i) for j in range(len(profile)-1) for i in range(SEG)]
    faces.append(tuple(reversed(range(SEG))))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();mesh.materials.append(mat)
    uv=mesh.uv_layers.new(name='Continuous wood grain')
    for poly in mesh.polygons:
        poly.use_smooth=True
        for loop in poly.loop_indices:uv.data[loop].uv=uvs[mesh.loops[loop].vertex_index]
    ob=bpy.data.objects.new(name,mesh);scene.collection.objects.link(ob);ob.parent=parent
    return ob

roots=[]
for side,mat in zip(['light','dark'],woods):
    template=None
    for king in [False,True]:
        name=f'{side}_{"king" if king else "man"}'
        root=bpy.data.objects.new(name,None);scene.collection.objects.link(root);roots.append(root)
        for tier in range(2 if king else 1):
            if template is None:template=make_counter(f'{name} counter {tier+1}',mat,root,0)
            else:
                counter=bpy.data.objects.new(f'{name} counter {tier+1}',template.data)
                scene.collection.objects.link(counter);counter.parent=root;counter.location.z=tier*.0092
        root.location=((len(roots)-2.5)*.054,0,0)

bpy.ops.object.select_all(action='DESELECT')
for root in roots:
    root.select_set(True)
    for child in root.children:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/'public/assets/draughts/rosette.glb'),export_format='GLB',use_selection=True,export_yup=True)

scene.world=bpy.data.worlds.new('Rosette studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.8,.85,1,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
for name,position,power,size in [('Key',(-.12,-.12,.22),4,.16),('Fill',(.2,-.05,.12),1.4,.16),('Rim',(.02,.2,.16),3,.1)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,0,.01))-obj.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Collection camera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);scene.camera=camera
data.type='ORTHO';data.ortho_scale=.25;camera.location=(.015,-.19,.21);camera.rotation_euler=(Vector((0,0,.006))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1400;scene.render.resolution_y=700;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(R/'ops/assets/draughts/rosette.blend'))
scene.render.filepath=str(OUT/'collection.png');bpy.ops.render.render(write_still=True)
print('ROSETTE_COMPLETE',len(roots))
