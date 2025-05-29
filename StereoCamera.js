class StereoCamera {
    constructor(eyeSeparation, convergence, aspectRatio, fov, nearClip, farClip) {
        this.eyeSeparation = eyeSeparation;
        this.convergence = convergence;
        this.aspectRatio = aspectRatio;
        this.fov = fov;
        this.nearClip = nearClip;
        this.farClip = farClip;
    }

    calcLeftFrustum() {
        const top = this.nearClip * Math.tan(this.fov / 2);
        const bottom = -top;
        
        const a = this.aspectRatio * Math.tan(this.fov / 2) * this.convergence;
        const b = a - this.eyeSeparation / 2;
        const c = a + this.eyeSeparation / 2;
        
        const left = -b * this.nearClip / this.convergence;
        const right = c * this.nearClip / this.convergence;
        
        return m4.frustum(left, right, bottom, top, this.nearClip, this.farClip);
    }

    calcRightFrustum() {
        const top = this.nearClip * Math.tan(this.fov / 2);
        const bottom = -top;
        
        const a = this.aspectRatio * Math.tan(this.fov / 2) * this.convergence;
        const b = a - this.eyeSeparation / 2;
        const c = a + this.eyeSeparation / 2;
        
        const left = -c * this.nearClip / this.convergence;
        const right = b * this.nearClip / this.convergence;
        
        return m4.frustum(left, right, bottom, top, this.nearClip, this.farClip);
    }
} 