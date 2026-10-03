"""Celadon: original contemporary carved ceramic Xiangqi, Blender 5.2.

blender -b -t 4 --python ops/assets/xiangqi/build_celadon.py -- --prototype
Default rebuild rebakes maps; --stage keeps delivery in ignored scratch files.
Use --reuse-bakes only with unchanged materials. See celadon-model.md.
"""
import bpy, bmesh, hashlib, json, math, sys
from array import array
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/atelier/celadon';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'output/atelier/hori/vendor'))
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from shapely import Polygon, union_all, constrained_delaunay_triangles
from shapely.geometry.polygon import orient
PROTOTYPE='--prototype' in sys.argv
STAGED='--stage' in sys.argv
FONT_PATH=ROOT/'output/playwright/intersection-font/NotoSerifCJKtc-Bold.otf'
assert hashlib.sha256(FONT_PATH.read_bytes()).hexdigest()=='a4441a76dbf56719600c5dcbd5b5e5a068a20944cc41c959487a657133576ee6'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene;scene.render.engine='CYCLES'
scene.cycles.samples=40;scene.cycles.use_denoising=True
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True;scene.render.bake.margin=8
scene.view_settings.view_transform='Khronos PBR Neutral'
font=bpy.data.fonts.load(str(FONT_PATH));font.use_fake_user=True
font_source=TTFont(str(FONT_PATH));font_glyphs=font_source.getGlyphSet()
FACE=.0123;DEPTH=.0004;RADIUS=.022
RING_IN=.01815;RING_OUT=.01860;RING_FLOOR=FACE-DEPTH
roots=[];glyph_cache={};audit={};shared_exteriors={};shared_rings={}


class OutlinePen(BasePen):
 def __init__(self):super().__init__(font_glyphs);self.contours=[];self.points=[]
 def _moveTo(self,p):self.points=[p]
 def _lineTo(self,p):self.points.append(p)
 def _curveToOne(self,a,b,c):
  def flatten(p,a,b,c,depth=0):
   chord=Vector(c)-Vector(p);den=max(chord.length,1e-9)
   cross=lambda q:abs(chord.x*(q[1]-p[1])-chord.y*(q[0]-p[0]))/den
   if depth>=12 or max(cross(a),cross(b))<.7:self.points.append(c);return
   mid=lambda x,y:((x[0]+y[0])/2,(x[1]+y[1])/2)
   pa,ab,bc=mid(p,a),mid(a,b),mid(b,c);pab,abc=mid(pa,ab),mid(ab,bc);center=mid(pab,abc)
   flatten(p,pa,pab,center,depth+1);flatten(center,abc,bc,c,depth+1)
  flatten(self.points[-1],a,b,c)
 def _closePath(self):
  if len(self.points)>2:self.contours.append(self.points)
  self.points=[]
 def _endPath(self):self._closePath()


def activate(ob):
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob


def material(name,color,roughness):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness
 return m


def ceramic_material(name,biscuit=False):
 """Original quiet glaze or fired-clay shader, baked at actual 52 mm UV scale."""
 m=material(name,(.48,.57,.49) if not biscuit else (.43,.35,.26),.32 if not biscuit else .76)
 n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF');out=n.get('Material Output')
 p.inputs['IOR'].default_value=1.48
 p.inputs['Coat Weight'].default_value=0 if biscuit else .20
 p.inputs['Coat Roughness'].default_value=.24
 uv=n.new('ShaderNodeTexCoord')
 broad=n.new('ShaderNodeTexNoise');broad.name='Original quiet kiln variation'
 broad.inputs['Scale'].default_value=4.8;broad.inputs['Detail'].default_value=2;broad.inputs['Roughness'].default_value=.6;l.new(uv.outputs['UV'],broad.inputs['Vector'])
 fine=n.new('ShaderNodeTexNoise');fine.name='Original microscopic fired surface'
 fine.inputs['Scale'].default_value=105 if biscuit else 88;fine.inputs['Detail'].default_value=2;fine.inputs['Roughness'].default_value=.68;l.new(uv.outputs['UV'],fine.inputs['Vector'])
 color=n.new('ShaderNodeValToRGB');color.name='Clay pigments' if biscuit else 'Pale jade-grey celadon pigments'
 color.color_ramp.elements[0].position=.16;color.color_ramp.elements[1].position=.84
 color.color_ramp.elements[0].color=(.36,.295,.218,1) if biscuit else (.435,.515,.445,1)
 color.color_ramp.elements[1].color=(.48,.397,.304,1) if biscuit else (.495,.584,.508,1)
 l.new(broad.outputs['Fac'],color.inputs[0])
 rough=n.new('ShaderNodeMapRange');rough.name='Fired matte foot' if biscuit else 'Restrained satin glaze'
 rough.inputs['To Min'].default_value=.70 if biscuit else .285;rough.inputs['To Max'].default_value=.81 if biscuit else .355;l.new(fine.outputs['Fac'],rough.inputs[0])
 bump=n.new('ShaderNodeBump');bump.name='Physical scale ceramic micro relief'
 bump.inputs['Strength'].default_value=.22 if biscuit else .11
 bump.inputs['Distance'].default_value=.00010 if biscuit else .000055
 l.new(fine.outputs['Fac'],bump.inputs['Height'])
 l.new(color.outputs[0],p.inputs['Base Color']);l.new(rough.outputs[0],p.inputs['Roughness']);l.new(bump.outputs[0],p.inputs['Normal'])
 bpy.ops.mesh.primitive_plane_add(size=.052);plane=bpy.context.object;plane.data.materials.append(m)
 target=n.new('ShaderNodeTexImage');n.active=target;images={}
 for key,source,size in [('colour',color.outputs[0],1024),('roughness',rough.outputs[0],512),('normal',None,512)]:
  file=OUT/(name.replace(' ','-')+'-'+key+('.jpg' if key=='colour' else '.png'))
  if '--reuse-bakes' in sys.argv and file.exists():
   im=bpy.data.images.load(str(file));im.colorspace_settings.name='sRGB' if key=='colour' else 'Non-Color';im.pack();images[key]=im;continue
  im=bpy.data.images.new(name+' '+key,width=size,height=size,alpha=False)
  if key!='colour':im.colorspace_settings.name='Non-Color'
  target.image=im;n.active=target
  if source:
   emit=n.new('ShaderNodeEmission');l.new(source,emit.inputs[0]);l.new(emit.outputs[0],out.inputs['Surface']);bpy.ops.object.bake(type='EMIT');n.remove(emit)
  else:l.new(p.outputs[0],out.inputs['Surface']);bpy.ops.object.bake(type='NORMAL')
  im.filepath_raw=str(file);im.file_format='JPEG' if key=='colour' else 'PNG';im.save();im.pack();images[key]=im
 bpy.data.objects.remove(plane,do_unlink=True);n.remove(target);l.new(p.outputs[0],out.inputs['Surface'])
 for key,input_name in [('colour','Base Color'),('roughness','Roughness')]:
  tex=n.new('ShaderNodeTexImage');tex.name='Portable '+key;tex.image=images[key];l.new(tex.outputs[0],p.inputs[input_name])
 tex=n.new('ShaderNodeTexImage');tex.name='Portable normal';tex.image=images['normal']
 normal=n.new('ShaderNodeNormalMap');l.new(tex.outputs[0],normal.inputs['Color']);l.new(normal.outputs[0],p.inputs['Normal'])
 return m


glaze=ceramic_material('Celadon pale jade grey glaze')
biscuit=ceramic_material('Celadon unglazed biscuit foot',True)
red=material('Celadon vermilion ink in recessed glaze',(.34,.007,.002),.54)
black=material('Celadon charcoal ink in recessed glaze',(.006,.007,.005),.58)
for ink in [red,black]:
 p=ink.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=0;p.inputs['Specular IOR Level'].default_value=.16


def lathe(name,profile,mat,segments=96):
 verts=[(r*math.cos(2*math.pi*i/segments),r*math.sin(2*math.pi*i/segments),z) for r,z in profile for i in range(segments)]
 faces=[]
 for j in range(len(profile)-1):
  for i in range(segments):
   a=j*segments+i;b=j*segments+(i+1)%segments;faces.append((a,b,b+segments,a+segments))
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();data.materials.append(mat)
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-9);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free();data.update()
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);return ob


def blank():
 # Continuous closed ceramic body: recessed underside, contact foot, narrowed
 # waist, shoulder, rolled lip and a true blind annular face channel.
 profile=[(0,.0011),(.0168,.0011),(.0178,.0004),(.0181,0),(.0187,0),
  (.019,.0003),(.019,.0012),(.0187,.002),(.0194,.0024),(.0204,.003),
  (.0212,.0039),(.0216,.0049),(.0216,.0089),(.0219,.0095),(.022,.0103),
  (.02194,.0112),(.0216,.0121),(.0210,.01265),(.0202,.0128),(.0196,.0127),
  (.0190,.0125),(.0189,FACE),(.0188,.0122),(.01872,.01196),
  (RING_OUT,RING_FLOOR),(RING_IN,RING_FLOOR),(.01803,.01196),
  (.01795,.0122),(.01785,FACE),(0,FACE)]
 ob=lathe('Celadon carved ceramic body',profile,glaze);ob.data.materials.append(biscuit)
 # Finish the identical blank before adding any glyph. A whole-body bevel
 # after engraving would let tight strokes clamp the exterior differently.
 activate(ob);bevel=ob.modifiers.new('Consistent softened ceramic blank','BEVEL')
 bevel.width=.000045;bevel.segments=2;bevel.limit_method='ANGLE';bevel.angle_limit=.7
 bevel.use_clamp_overlap=False;bpy.ops.object.modifier_apply(modifier=bevel.name)
 return ob


def glyph_template(char):
 if char in glyph_cache:return glyph_cache[char]
 curve=bpy.data.curves.new('Editable licensed Noto TC source '+char,'FONT');curve.body=char;curve.font=font;curve.use_fake_user=True
 pen=OutlinePen();font_glyphs[font_source.getBestCmap()[ord(char)]].draw(pen)
 signed=lambda ring:sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]+ring[:1]))/2
 sign=1 if signed(max(pen.contours,key=lambda p:abs(signed(p))))>0 else -1
 outer=[Polygon(p).buffer(0) for p in pen.contours if signed(p)*sign>0]
 holes=[Polygon(p).buffer(0) for p in pen.contours if signed(p)*sign<0]
 shape=union_all(outer).difference(union_all(holes)).buffer(10,join_style='mitre',mitre_limit=2)
 if not shape.is_valid or shape.is_empty:raise RuntimeError('Invalid outline '+char)
 x0,y0,x1,y1=shape.bounds;cx=(x0+x1)/2;cy=(y0+y1)/2
 polygons=[shape] if shape.geom_type=='Polygon' else list(shape.geoms)
 radius=max(math.hypot(x-cx,y-cy) for polygon in polygons for x,y in polygon.exterior.coords)
 factor=min(.030/(x1-x0),.030/(y1-y0),.0168/radius)
 verts=[];faces=[];indices={}
 def index(x,y,z):
  key=(round(x,7),round(y,7),z)
  if key not in indices:indices[key]=len(verts);verts.append(((x-cx)*factor,(y-cy)*factor,z))
  return indices[key]
 for polygon in polygons:
  polygon=orient(polygon,sign=1)
  for triangle in constrained_delaunay_triangles(polygon).geoms:
   points=list(orient(triangle,sign=1).exterior.coords)[:-1]
   faces.append(tuple(index(x,y,1) for x,y in points));faces.append(tuple(index(x,y,0) for x,y in reversed(points)))
  for ring in [polygon.exterior,*polygon.interiors]:
   points=list(ring.coords)
   for (x,y),(xx,yy) in zip(points,points[1:]):faces.append((index(x,y,0),index(xx,yy,0),index(xx,yy,1),index(x,y,1)))
 data=bpy.data.meshes.new('Unified licensed TC outline '+char);data.from_pydata(verts,[],faces);data.update();data.validate(verbose=True);data.use_fake_user=True;glyph_cache[char]=data;return data


def glyph(char,bottom,top,name):
 data=glyph_template(char).copy();ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
 for v in data.vertices:v.co.z=bottom+(top-bottom)*v.co.z
 data.update()
 return ob


def carve(body,char,ink):
 cutter=glyph(char,FACE-DEPTH,FACE+.0007,'Carving tool '+char)
 activate(body);mod=body.modifiers.new('Genuine blind face engraving '+char,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.use_self=True;mod.object=cutter
 bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
 # Bevel only the newly cut character, preserving the already-finished shell.
 bm=bmesh.new();bm.from_mesh(body.data);weights=bm.edges.layers.float.new('bevel_weight_edge')
 for edge in bm.edges:
  glyph_edge=all(math.hypot(v.co.x,v.co.y)<.0170 and v.co.z>.0115 for v in edge.verts)
  edge[weights]=1 if glyph_edge and edge.is_manifold and edge.calc_face_angle(0)>.7 else 0
 bm.to_mesh(body.data);bm.free();body.data.update()
 bevel=body.modifiers.new('Soft glaze on carved lip','BEVEL');bevel.width=.000045;bevel.segments=2;bevel.limit_method='WEIGHT'
 bpy.ops.object.modifier_apply(modifier=bevel.name)
 paint=glyph(char,FACE-DEPTH+.000008,FACE-DEPTH+.000035,'Face ink '+char);paint.data.materials.append(ink);return paint


def map_body(ob):
 data=ob.data;data.update()
 for old in list(data.uv_layers):data.uv_layers.remove(old)
 uv=data.uv_layers.new(name='Physical 52 mm ceramic UV');uv.active_render=True
 for poly in data.polygons:
  center=poly.center;poly.material_index=1 if center.z<.0016 else 0
  # Keep broad faces and engraved walls crisp; smooth the turned radial body.
  radius=math.hypot(center.x,center.y)
  poly.use_smooth=radius>.0172 and abs(poly.normal.z)<.98
  for li in poly.loop_indices:
   v=data.vertices[data.loops[li].vertex_index].co
   if abs(poly.normal.z)>.55:uv.data[li].uv=(v.x/.052+.5,v.y/.052+.5)
   else:
    theta=math.atan2(v.y,v.x);center_theta=math.atan2(center.y,center.x)
    if theta-center_theta>math.pi:theta-=2*math.pi
    if theta-center_theta<-math.pi:theta+=2*math.pi
    uv.data[li].uv=(theta*RADIUS/.052,v.z/.052)
 data.update()


def map_ink(ob):
 data=ob.data;uv=data.uv_layers.new(name='Inset ink UV')
 for poly in data.polygons:
  for li in poly.loop_indices:
   v=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/.052+.5,v.y/.052+.5)


def mesh_snapshot(source):
 """Read computed corner data once, avoiding repeated Blender cache lookups."""
 coordinates=array('f',[0.0])*(len(source.vertices)*3);source.vertices.foreach_get('co',coordinates)
 normals=array('f',[0.0])*(len(source.corner_normals)*3);source.corner_normals.foreach_get('vector',normals)
 uvs=array('f',[0.0])*(len(source.loops)*2);source.uv_layers.active.data.foreach_get('uv',uvs)
 return {'co':[tuple(coordinates[i:i+3]) for i in range(0,len(coordinates),3)],
  'normal':[tuple(normals[i:i+3]) for i in range(0,len(normals),3)],
  'uv':[tuple(uvs[i:i+2]) for i in range(0,len(uvs),2)],
  'smooth':[polygon.use_smooth for polygon in source.polygons]}


def mesh_subset(source,triangles,name,snapshot):
 """Preserve evaluated triangles, corner normals and UVs exactly when splitting."""
 vertices=[];faces=[];indices={};normals=[];uvs=[];materials=[];smooth=[]
 for triangle in triangles:
  face=[]
  for vertex,loop in zip(triangle.vertices,triangle.loops):
   if vertex not in indices:indices[vertex]=len(vertices);vertices.append(snapshot['co'][vertex])
   face.append(indices[vertex]);normals.append(snapshot['normal'][loop]);uvs.extend(snapshot['uv'][loop])
  faces.append(tuple(face));materials.append(triangle.material_index);smooth.append(snapshot['smooth'][triangle.polygon_index])
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update()
 for material in source.materials:data.materials.append(material)
 uv=data.uv_layers.new(name='Physical 52 mm ceramic UV');uv.active_render=True
 uv.data.foreach_set('uv',uvs)
 data.polygons.foreach_set('material_index',materials);data.polygons.foreach_set('use_smooth',smooth)
 data.normals_split_custom_set(normals);data.update();return data


def share_ceramic_exterior(body):
 """Share identical visible shell triangles without simplifying the engraving.

 The final assembled surface is unchanged. Splitting adds no hidden cap, seam
 face, duplicate surface or lower-detail substitute. Exact attribute digests
 prevent geometry with differing normals/UVs from being shared accidentally.
 """
 source=body.data;source.calc_loop_triangles();snapshot=mesh_snapshot(source)
 common_polygons=set()
 for polygon in source.polygons:
  points=[snapshot['co'][i] for i in polygon.vertices]
  if max(v[2] for v in points)<=.0113001 or min(math.hypot(v[0],v[1]) for v in points)>=.0177:common_polygons.add(polygon.index)
 common=[t for t in source.loop_triangles if t.polygon_index in common_polygons]
 unique=[t for t in source.loop_triangles if t.polygon_index not in common_polygons]
 signatures=[]
 for triangle in common:
  corners=[]
  for vertex,loop in zip(triangle.vertices,triangle.loops):
   corners.append((*snapshot['co'][vertex],*snapshot['normal'][loop],*snapshot['uv'][loop]))
  signatures.append((triangle.material_index,min(tuple(corners[i:]+corners[:i]) for i in range(3))))
 signature=hashlib.sha256(repr(sorted(signatures)).encode()).hexdigest()
 if signature not in shared_exteriors:shared_exteriors[signature]=mesh_subset(source,common,'Shared turned celadon shell',snapshot)
 exterior=bpy.data.objects.new('Celadon shared turned ceramic exterior',shared_exteriors[signature]);scene.collection.objects.link(exterior)
 body.data=mesh_subset(source,unique,'Unique carved celadon face',snapshot)
 return exterior


ROLES=['general','advisor','elephant','horse','chariot','cannon','soldier']
LETTERS={'light':['帥','仕','相','傌','俥','炮','兵'],'dark':['將','士','象','馬','車','砲','卒']}


def piece(side,role,index):
 char=LETTERS[side][index];ink=red if side=='light' else black
 print('CARVING',side,role,char,flush=True)
 root=bpy.data.objects.new(side+'_'+role,None);scene.collection.objects.link(root);roots.append(root)
 root['collection']='celadon';root['owner']='red' if side=='light' else 'black';root['role']=role;root['frontGlyph']=char
 body=blank();paint=carve(body,char,ink)
 if side in shared_rings:
  ring=bpy.data.objects.new('Ring ink in engraved channel',shared_rings[side]);scene.collection.objects.link(ring)
 else:
  ring=lathe('Ring ink in engraved channel',[(RING_IN+.000025,RING_FLOOR+.000008),(RING_OUT-.000025,RING_FLOOR+.000008),(RING_OUT-.000025,RING_FLOOR+.000035),(RING_IN+.000025,RING_FLOOR+.000035),(RING_IN+.000025,RING_FLOOR+.000008)],ink,128)
  map_ink(ring);shared_rings[side]=ring.data
 map_body(body);map_ink(paint);exterior=share_ceramic_exterior(body)
 for child in [body,exterior,paint,ring]:child.parent=root
 root.location=((index-3)*.051,.034 if side=='dark' else -.026,0)


if PROTOTYPE:
 piece('light','general',0);piece('dark','general',0)
 for i,root in enumerate(roots):root.location=((i-.5)*.050,0,0)
else:
 for side in ['light','dark']:
  for i,role in enumerate(ROLES):piece(side,role,i)
bpy.context.view_layer.update()
for root in roots:
 vertices=[];triangles=0
 for ob in root.children:
  ob.data.calc_loop_triangles();triangles+=len(ob.data.loop_triangles);vertices += [ob.matrix_local@v.co for v in ob.data.vertices]
 mn=[min(v[i] for v in vertices) for i in range(3)];mx=[max(v[i] for v in vertices) for i in range(3)]
 audit[root.name]={'triangles':triangles,'min':mn,'max':mx,'height':mx[2]-mn[2]}
 if mx[2]>.0128001 or mn[2]<-.000001 or mx[0]-mn[0]>.044001:raise RuntimeError('Physical envelope '+root.name)
 if triangles>25000:raise RuntimeError('Triangle budget '+root.name+' '+str(triangles))
(OUT/('prototype-audit.json' if PROTOTYPE else 'geometry-audit.json')).write_text(json.dumps(audit,indent=2))
prefix='prototype' if PROTOTYPE else 'staged-celadon'
model=OUT/(prefix+'.glb') if PROTOTYPE or STAGED else ROOT/'public/assets/xiangqi/celadon.glb'
bpy.ops.object.select_all(action='DESELECT')
for root in roots:
 root.select_set(True)
 for child in root.children:child.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(model),export_format='GLB',use_selection=True,export_materials='EXPORT',export_image_format='AUTO',export_yup=True,export_extras=True)

scene.world=bpy.data.worlds.new('Celadon studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.87,.93,1,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.18
for name,pos,power,size,color in [('Key',(-.17,-.19,.30),1.7,.17,(1,.96,.88)),('Fill',(.20,-.03,.18),.65,.18,(.86,.95,1)),('Rim',(.04,.23,.26),1.0,.14,(1,.98,.94))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector((0,0,.006))-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Celadon collection review camera');camera=bpy.data.objects.new(data.name,data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=.115 if PROTOTYPE else .385
camera.location=(.012,-.20,.31) if PROTOTYPE else (.035,-.32,.52);camera.rotation_euler=(Vector((0,0,.006))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1400;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/(prefix+'-preview.png') if PROTOTYPE or STAGED else ROOT/'ops/assets/xiangqi/celadon-preview.png')
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(prefix+'.blend') if PROTOTYPE or STAGED else ROOT/'ops/assets/xiangqi/celadon.blend'))
bpy.ops.render.render(write_still=True)
if PROTOTYPE:
 scene.render.resolution_x=105;scene.render.resolution_y=64
 scene.render.filepath=str(OUT/'prototype-playing-size.png');bpy.ops.render.render(write_still=True)
 camera.location=(0,-.20,.07);camera.rotation_euler=(Vector((0,0,.006))-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.resolution_x=1400;scene.render.resolution_y=650
 scene.render.filepath=str(OUT/'prototype-profile.png');bpy.ops.render.render(write_still=True)
else:
 scene.render.resolution_x=175;scene.render.resolution_y=106
 scene.render.filepath=str(OUT/'collection-20px-proof.png');bpy.ops.render.render(write_still=True)
print('CELADON_COMPLETE',json.dumps(audit),flush=True)
