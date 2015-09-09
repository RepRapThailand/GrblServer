Polymer({
	is: "cnc-gcode",
	properties: {
	},

	created : function () {
	},

	ready : function () {
	},

	attached : function () {
		var self = this;
		var container = document.getElementById('container');

		var scene = new THREE.Scene();
		var camera = new THREE.PerspectiveCamera( 75, 3/2, 0.1, 1000 );
		camera.position.z = 100;

		var controls = new THREE.TrackballControls(camera, container);
		controls.dynamicDampingFactor = 0.5;
		controls.rotateSpeed = 2;
		controls.zoomSpeed = 1;
		controls.panSpeed = 1;
		controls.addEventListener("change", function () {
			self.render();
		});


		var renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio( window.devicePixelRatio );
		container.appendChild( renderer.domElement );

		var arrowX = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 10, 0x990000, 3, 3);
		arrowX.line.material.linewidth = 5;
		scene.add(arrowX);
		var arrowY = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 10, 0x009900, 3, 3);
		arrowY.line.material.linewidth = 5;
		scene.add(arrowY);
		var arrowZ = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 10, 0x000099, 3, 3);
		arrowZ.line.material.linewidth = 5;
		scene.add(arrowZ);

		var helper = new THREE.GridHelper( 200, 10 );
		helper.setColors( 0x999999, 0x444444 );
		helper.position.y = 0;
		helper.rotation.x = Math.PI / 2;
		scene.add( helper );

		self.scene = scene;
		self.camera = camera;
		self.renderer = renderer;
		self.controls = controls;
		self.refit();
		self.render();

		self.dispatchEvent(new CustomEvent("cnc-gcode-initialized", {
			detail: null
		}));

		requestAnimationFrame(function render () {
			controls.update();
			requestAnimationFrame(render);
		});
	},

	refit : function () {
		var self = this;

		var container = document.getElementById('container');
		console.log('creating three.js view for', container, container.offsetWidth, container.offsetHeight);

		var width = container.offsetWidth;
		var height = container.offsetHeight;

		self.camera.aspect = width / height;
		self.camera.updateProjectionMatrix();

		self.renderer.setSize(width, height);
		self.renderer.setPixelRatio( window.devicePixelRatio );
	},

	render : function () {
		var self = this;
		self.renderer.render(self.scene, self.camera);
	},


	/**
	 * Initialize G-code context
	 */
	initContext : function () {
		var self = this;
		self.context = new gcode.Context();
	},

	/**
	 * Execute a G-code block
	 *
	 * @return {number} duration
	 */
	executeBlock : function (line) {
		var self = this;
		return self.context.executeBlock(gcode.Block.parse(line));
	},

	/**
	 * A utility method for just showing paths
	 *
	 * 1. initContext()
	 * 2. split argument to lines and execute
	 * 3. constructPathObject()
	 * 4. render()
	 */
	loadGCode : function (raw) {
		var self = this;
		self.initContext();
		self.context.rapidFeedRate = 800; // TODO attribute

		var duration = 0;
		var lines = raw.split(/\n/);
		for (var i = 0, len = lines.length; i < len; i++) {
			duration += self.context.executeBlock(gcode.Block.parse(lines[i]));
		}
		console.log('duration', duration);

		self.constuctPathObject();
		self.render();
	},

	constuctPathObject : function () {
		var self = this;
		if (self.path) {
			self.scene.remove(self.path);
			for (var key in self.path.geometry.attributes) if (self.path.geometry.attributes.hasOwnProperty(key)) {
				self.path.geometry.attributes[key].dispose();
			}
			self.path.geometry.dispose();
		}

		var geometry = new THREE.BufferGeometry();
		var material = new THREE.ShaderMaterial({
			uniforms:       {},
			attributes:     {},
			vertexShader:   document.getElementById('vertexshader').textContent,
			fragmentShader: document.getElementById('fragmentshader').textContent,
			blending:       THREE.AdditiveBlending,
			depthTest:      false,
			transparent:    true,
			vertexColors: THREE.VertexColors,
			linewidth: 2
		});

		var positions = new Float32Array(self.context.motions.length * 6 + 1);
		var colors = new Float32Array(self.context.motions.length * 6 + 1);

		positions[0] = 0;
		positions[1] = 0;
		positions[2] = 0;
		colors[0] = 1;
		colors[1] = 1;
		colors[2] = 1;

		for (var i = 1, len = self.context.motions.length; i < len; i++) {
			var motion = self.context.motions[i];
			positions[i * 6 + 0] = motion.prevMotion.x;
			positions[i * 6 + 1] = motion.prevMotion.y;
			positions[i * 6 + 2] = motion.prevMotion.z;
			positions[i * 6 + 3] = motion.x;
			positions[i * 6 + 4] = motion.y;
			positions[i * 6 + 5] = motion.z;

			if (motion.type === 'G0') {
				colors[i * 6 + 0] = colors[i * 6 + 3] = 1;
				colors[i * 6 + 1] = colors[i * 6 + 4] = 0;
				colors[i * 6 + 2] = colors[i * 6 + 5] = 0;
			} else
			if (motion.type === 'G2' || motion.type === 'G3') {
				colors[i * 6 + 0] = colors[i * 6 + 3] = 1;
				colors[i * 6 + 1] = colors[i * 6 + 4] = 0;
				colors[i * 6 + 2] = colors[i * 6 + 5] = 1;
			} else {
				colors[i * 6 + 0] = colors[i * 6 + 3] = 1;
				colors[i * 6 + 1] = colors[i * 6 + 4] = 1;
				colors[i * 6 + 2] = colors[i * 6 + 5] = 1;
			}
		}

		geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
		geometry.addAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );

		geometry.computeBoundingBox();

		self.controls.target0.x = self.controls.position0.x = (Math.abs(geometry.boundingBox.max.x) - Math.abs(geometry.boundingBox.min.x)) / 2;
		self.controls.target0.y = self.controls.position0.y = (Math.abs(geometry.boundingBox.max.y) - Math.abs(geometry.boundingBox.min.y)) / 2;
		self.controls.position0.z =  Math.max(geometry.boundingBox.max.y - geometry.boundingBox.min.y, geometry.boundingBox.max.x - geometry.boundingBox.min.x) / 2 / Math.tan(Math.PI * self.camera.fov / 360);
		self.controls.reset();

		self.path = new THREE.Line( geometry, material );
		self.scene.add(self.path);
	},

	reset : function () {
		this.controls.reset();
	}
});
