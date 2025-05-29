'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let stereoCam;                  // Object holding stereo camera and its parameters

// Variables for WebSocket and phone rotation matrix
let websocket = null;
let phoneRotationMatrix = null;
let usePhoneOrientation = false;

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

// Implementation of getRotationMatrixFromVector from Android
function getRotationMatrixFromVector(rotationMatrix, rotationVector) {
    const q0 = rotationVector[3]; // w
    const q1 = rotationVector[0]; // x
    const q2 = rotationVector[1]; // y
    const q3 = rotationVector[2]; // z
    
    const sq_q1 = 2 * q1 * q1;
    const sq_q2 = 2 * q2 * q2;
    const sq_q3 = 2 * q3 * q3;
    const q1_q2 = 2 * q1 * q2;
    const q3_q0 = 2 * q3 * q0;
    const q1_q3 = 2 * q1 * q3;
    const q2_q0 = 2 * q2 * q0;
    const q2_q3 = 2 * q2 * q3;
    const q1_q0 = 2 * q1 * q0;
    
    // Fill matrix in row-major order
    rotationMatrix[0] = 1 - sq_q2 - sq_q3;
    rotationMatrix[1] = q1_q2 - q3_q0;
    rotationMatrix[2] = q1_q3 + q2_q0;
    
    rotationMatrix[3] = q1_q2 + q3_q0;
    rotationMatrix[4] = 1 - sq_q1 - sq_q3;
    rotationMatrix[5] = q2_q3 - q1_q0;
    
    rotationMatrix[6] = q1_q3 - q2_q0;
    rotationMatrix[7] = q2_q3 + q1_q0;
    rotationMatrix[8] = 1 - sq_q1 - sq_q2;
    
    // Convert to a format suitable for WebGL (from row-major to 4x4 matrix)
    const m4Matrix = [
        rotationMatrix[0], rotationMatrix[3], rotationMatrix[6], 0,
        rotationMatrix[1], rotationMatrix[4], rotationMatrix[7], 0,
        rotationMatrix[2], rotationMatrix[5], rotationMatrix[8], 0,
        0, 0, 0, 1
    ];
    
    return m4Matrix;
}

// Function to connect to WebSocket
function connectToSensorServer() {
    const wsUrl = document.getElementById('wsUrl').value;
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const statusElement = document.getElementById('connectionStatus');
    
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function() {
            console.log('Connected to sensor server');
            statusElement.textContent = 'Підключено';
            statusElement.classList.add('connected');
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            usePhoneOrientation = true;
        };
        
        websocket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);

                if (data.values && data.values.length >= 4) {
                    // game_rotation_vector returns quaternion [x, y, z, w]
                    const rotationVector = [
                        data.values[0], // x
                        data.values[1], // y
                        data.values[2], // z
                        data.values[3]  // w (scalar)
                    ];

                    updateSensorValuesDisplay(rotationVector);
                    
                    // Create a new rotation matrix and fill it
                    const tempMatrix = new Array(9).fill(0);
                    phoneRotationMatrix = getRotationMatrixFromVector(tempMatrix, rotationVector);
                    
                    // Trigger redraw
                    draw();
                }
            } catch (error) {
                console.error('Error processing sensor data:', error);
            }
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            statusElement.textContent = 'Помилка';
            statusElement.classList.remove('connected');
        };
        
        websocket.onclose = function() {
            console.log('Disconnected from sensor server');
            statusElement.textContent = 'Відключено';
            statusElement.classList.remove('connected');
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            usePhoneOrientation = false;
            phoneRotationMatrix = null;
        };
    } catch (error) {
        console.error('Failed to connect to sensor server:', error);
        statusElement.textContent = 'Помилка з\'єднання';
        statusElement.classList.remove('connected');
    }
}

// Function to update sensor values display with 2 decimal places
function updateSensorValuesDisplay(rotationVector) {
    const elements = ['sensorValueX', 'sensorValueY', 'sensorValueZ', 'sensorValueW'];
    elements.forEach((id, index) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = rotationVector[index].toFixed(2);
        } else {
            console.warn(`Element ${id} not found`);
        }
    });
}

// Function to disconnect from WebSocket
function disconnectFromSensorServer() {
    if (websocket) {
        websocket.close();
        websocket = null;
    }
    updateSensorValuesDisplay([0, 0, 0, 0]);
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Get the view matrix from the SimpleRotator object or from the phone.*/
    let modelView;
    if (usePhoneOrientation && phoneRotationMatrix) {
         // Apply inverse rotation to compensate for the default rotation in the mouse control mode
         let inverseRotation = m4.axisRotation([0.707, 0.707, 0], -0.7);
    
         // Multiply phone matrix with compensating matrix
         modelView = m4.multiply(inverseRotation, phoneRotationMatrix);
    } else {
        // Otherwise use standard rotation from SimpleRotator
        modelView = spaceball.getViewMatrix();
    }

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
 * Функция для обновления параметров стереокамеры
 */
function updateStereoCameraParams() {
    if (stereoCam) {
        stereoCam.eyeSeparation = parseFloat(document.getElementById('eyeSeparation').value);
        stereoCam.convergence = parseFloat(document.getElementById('convergence').value);
        stereoCam.aspectRatio = parseFloat(document.getElementById('aspectRatio').value);
        stereoCam.fov = parseFloat(document.getElementById('fov').value);
        
        // Перерисовываем сцену с новыми параметрами
        draw();
    }
}

/**
 * Функция для синхронизации значений между слайдерами и числовыми полями
 */
function syncControlValues(paramName, value) {
    document.getElementById(paramName).value = value;
    document.getElementById(paramName + 'Value').value = value;
    updateStereoCameraParams();
}

/**
 * Инициализация обработчиков событий для элементов управления
 */
function initControls() {
    // Массив параметров для настройки
    const params = ['eyeSeparation', 'convergence', 'aspectRatio', 'fov'];
    
    params.forEach(param => {
        // Обработчики для слайдеров
        document.getElementById(param).addEventListener('input', function() {
            syncControlValues(param, this.value);
        });
        
        // Обработчики для числовых полей
        document.getElementById(param + 'Value').addEventListener('input', function() {
            syncControlValues(param, this.value);
        });
    });
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
            throw new Error("Browser does not support WebGL");
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

    // Инициализируем элементы управления стереокамерой
    initControls();

    // Add event handlers for WebSocket buttons
    document.getElementById('connectBtn').addEventListener('click', connectToSensorServer);
    document.getElementById('disconnectBtn').addEventListener('click', disconnectFromSensorServer);

    // Continuous rendering for better responsiveness
    function animate() {
        draw();
        requestAnimationFrame(animate);
    }
    animate();
}
