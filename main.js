'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    //let projection = m4.perspective(Math.PI/8, 1, 8, 12);
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    // The FIRST PASS (for the left eye)

    let matrLeftFrustum = stereoCam.calcLeftFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrLeftFrustum);

    let translateLeftEye = m4. translation(stereoCam.eyeSeparation/2, 0, 0);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateLeftEye, matAccum0 );
    let matAccum2 = m4.multiply(translateToPointZero, matAccum1 );
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    // let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );
    
    gl.colorMask(true, false, false, true);
    gl.uniform4fv(shProgram.iColor, [1,1,1,1] );
    surface.Draw();

    // The SECOND PASS (for the right eye)

    gl.clear(gl.DEPTH_BUFFER_BIT);

    let matrRightFrustum = stereoCam.calcRightFrustum();
    gl.uniformMatrix4fv(shProgram.iProjectionMatrix, false, matrRightFrustum);

    let translateRightEye = m4. translation(-stereoCam.eyeSeparation/2, 0, 0);

    matAccum0 = m4.multiply(rotateToPointZero, modelView );
    matAccum1 = m4.multiply(translateRightEye, matAccum0 );
    matAccum2 = m4.multiply(translateToPointZero, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, matAccum2 );

    gl.colorMask(false, true, true, true);
    gl.uniform4fv(shProgram.iColor, [1,1,1,1] );
    surface.Draw();

    gl.colorMask(true, true, true, true);
}

// Constructor for simple vertex model (like in main_2.js)
function SimpleModel(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
        this.count = vertices.length / 3;
    };

    this.Draw = function() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.drawArrays(gl.LINE_STRIP, 0, this.count);
    };
}

function CreateSievertSurfaceData(C, uSteps, vSteps) {
    let vertexList = [];
    for (let i = 0; i <= uSteps; i++) {
        let u = ((i / uSteps) - 0.5) * Math.PI; // u in range [-π/2, π/2]
        for (let j = 0; j <= vSteps; j++) {
            let v = (j / vSteps) * Math.PI; // v in range [0, π]

            // Calculate ϕ
            let phi = -u / Math.sqrt(C + 1) + Math.atan(Math.tan(u) * Math.sqrt(C + 1));

            // Calculate a and r
            let a = 2 / (C + 1 - C * Math.sin(v) ** 2 * Math.cos(u));
            let r = (a * Math.sqrt((C + 1) * (1 + C * Math.sin(u) ** 2)) * Math.sin(v)) / Math.sqrt(C);

            // Parametric equations
            let x = r * Math.cos(phi) - 2;
            let y = r * Math.sin(phi);
            let z = (Math.log(Math.tan(v / 2)) + a * (C + 1) * Math.cos(v)) / Math.sqrt(C);

            vertexList.push(x, y, z);
        }
    }
    return vertexList;
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewMatrix           = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iProjectionMatrix          = gl.getUniformLocation(prog, "ProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new SimpleModel('Surface');
    surface.BufferData(CreateSievertSurfaceData(1, 50, 50));

    stereoCam = new StereoCamera(
        .7,     // decimeters
        14.0,   // decimeters
        1.3,    // aspect ratio of canvas
        0.4,    // radians
        8.0,    // decimeters
        20.0    // decimeters
    );

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}
