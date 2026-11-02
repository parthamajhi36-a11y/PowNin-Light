/* =====================================================
   POWNIN ADVANCED MATH ENGINE v4.0
   PART 1/5 — CORE + ALGEBRA
   ===================================================== */

(function () {
"use strict";

const VERSION = "4.0";
const EPSILON = 1e-10;
const MAX_LENGTH = 1000;
const MAX_RESULT = 1e100;

function checked(n) {
    if (!Number.isFinite(n) || Math.abs(n) > MAX_RESULT) {
        throw new Error("Result is outside supported range.");
    }
    return Math.abs(n) < EPSILON ? 0 : Number(n.toPrecision(12));
}

function valid(n) {
    return typeof n === "number" && Number.isFinite(n);
}

function normalizeDigits(value) {
    const map = {
        "০":"0","১":"1","২":"2","৩":"3","৪":"4",
        "৫":"5","৬":"6","৭":"7","৮":"8","৯":"9",
        "०":"0","१":"1","२":"2","३":"3","४":"4",
        "५":"5","६":"6","७":"7","८":"8","९":"9"
    };
    return String(value).replace(/[০-৯०-९]/g, c => map[c]);
}

function normalizeText(value) {
    return normalizeDigits(String(value || ""))
        .toLowerCase()
        .replace(/[×]/g, "*")
        .replace(/[÷]/g, "/")
        .replace(/[−–]/g, "-")
        .replace(/π/g, "pi")
        .replace(/\s+/g, " ")
        .trim();
}

function factorial(n) {
    if (!Number.isInteger(n) || n < 0 || n > 170) {
        throw new Error("Factorial requires an integer from 0 to 170.");
    }
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return checked(result);
}

function gcd(a, b) {
    a = Math.abs(Math.trunc(a));
    b = Math.abs(Math.trunc(b));
    while (b) [a, b] = [b, a % b];
    return a;
}

function lcm(a, b) {
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
        throw new Error("LCM requires integers.");
    }
    if (!a || !b) return 0;
    return checked(Math.abs(a / gcd(a, b) * b));
}

function isPrime(n) {
    if (!Number.isSafeInteger(n) || n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
        if (n % i === 0) return false;
    }
    return true;
}

function primeFactors(n) {
    if (!Number.isSafeInteger(n) || n < 1) {
        throw new Error("Enter a positive integer.");
    }
    const factors = [];
    for (let d = 2; d <= Math.sqrt(n); d++) {
        while (n % d === 0) {
            factors.push(d);
            n /= d;
        }
    }
    if (n > 1) factors.push(n);
    return factors;
}

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

function mathFunction(name, args) {
    const x = args[0];

    switch (name) {
        case "sqrt": return checked(Math.sqrt(x));
        case "cbrt": return checked(Math.cbrt(x));
        case "abs": return Math.abs(x);
        case "floor": return Math.floor(x);
        case "ceil": return Math.ceil(x);
        case "round": return Math.round(x);
        case "sin": return checked(Math.sin(toRadians(x)));
        case "cos": return checked(Math.cos(toRadians(x)));
        case "tan":
            if (Math.abs(Math.cos(toRadians(x))) < EPSILON)
                throw new Error("Tangent is undefined.");
            return checked(Math.tan(toRadians(x)));
        case "asin": return checked(Math.asin(x) * 180 / Math.PI);
        case "acos": return checked(Math.acos(x) * 180 / Math.PI);
        case "atan": return checked(Math.atan(x) * 180 / Math.PI);
        case "log": return checked(Math.log10(x));
        case "ln": return checked(Math.log(x));
        case "exp": return checked(Math.exp(x));
        case "fact":
        case "factorial": return factorial(x);
        case "gcd": return gcd(args[0], args[1]);
        case "lcm": return lcm(args[0], args[1]);
        case "min": return Math.min(...args);
        case "max": return Math.max(...args);
        default: throw new Error("Unknown function: " + name);
    }
}

/* ---------- EXPRESSION PARSER ---------- */

function tokenize(input) {
    const tokens = [];
    const regex =
        /\d+(?:\.\d*)?(?:e[+-]?\d+)?|(?:\.\d+)|[a-zA-Z]+|[()+\-*/%^!,]/gy;

    let position = 0;

    while (position < input.length) {
        if (/\s/.test(input[position])) {
            position++;
            continue;
        }

        regex.lastIndex = position;
        const match = regex.exec(input);

        if (!match) throw new Error("Invalid expression.");

        tokens.push(match[0]);
        position = regex.lastIndex;

        if (tokens.length > 250) {
            throw new Error("Expression is too long.");
        }
    }

    return tokens;
}

function parseExpression(input) {
    const tokens = tokenize(input);
    let position = 0;

    function peek() {
        return tokens[position];
    }

    function consume() {
        return tokens[position++];
    }

    function primary() {
        const token = consume();

        if (token === undefined) throw new Error("Incomplete expression.");

        if (token === "(") {
            const value = expression();
            if (consume() !== ")") throw new Error("Missing closing bracket.");
            return value;
        }

        if (token === "pi") return Math.PI;
        if (token === "e") return Math.E;

        if (/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(token)) {
            return checked(Number(token));
        }

        if (/^[a-z]+$/i.test(token)) {
            const name = token;

            if (consume() !== "(") throw new Error("Function needs parentheses.");

            const args = [];

            if (peek() !== ")") {
                do {
                    args.push(expression());
                    if (peek() !== ",") break;
                    consume();
                } while (true);
            }

            if (consume() !== ")") throw new Error("Missing function bracket.");

            return checked(mathFunction(name, args));
        }

        throw new Error("Unexpected token: " + token);
    }

    function postfix() {
        let value = primary();

        while (peek() === "!") {
            consume();
            value = factorial(value);
        }

        return value;
    }

    function unary() {
        if (peek() === "+") {
            consume();
            return unary();
        }
        if (peek() === "-") {
            consume();
            return -unary();
        }
        return postfix();
    }

    function power() {
        let value = unary();
        if (peek() === "^") {
            consume();
            value = Math.pow(value, unary());
        }
        return checked(value);
    }

    function term() {
        let value = power();

        while (["*", "/", "%"].includes(peek())) {
            const operator = consume();
            const right = power();

            if (operator === "*") value *= right;
            if (operator === "/") {
                if (right === 0) throw new Error("Division by zero.");
                value /= right;
            }
            if (operator === "%") {
                if (right === 0) throw new Error("Division by zero.");
                value %= right;
            }
        }
        return checked(value);
    }

    function expression() {
        let value = term();

        while (peek() === "+" || peek() === "-") {
            const operator = consume();
            const right = term();
            value = operator === "+" ? value + right : value - right;
        }

        return checked(value);
    }

    const result = expression();

    if (position !== tokens.length) {
        throw new Error("Unexpected expression content.");
    }

    return checked(result);
}

/* ---------- ALGEBRA ---------- */

function solveLinear(a, b, c) {
    if (![a,b,c].every(valid)) throw new Error("Invalid coefficients.");

    if (Math.abs(a) < EPSILON) {
        return Math.abs(b-c) < EPSILON
            ? { type:"infinite", answer:"Infinite solutions" }
            : { type:"none", answer:"No solution" };
    }

    return {
        type:"linear",
        answer:checked((c-b)/a)
    };
}

function solveQuadratic(a, b, c) {
    if (![a,b,c].every(valid)) throw new Error("Invalid coefficients.");

    if (Math.abs(a) < EPSILON) return solveLinear(b,c,0);

    const d = b*b - 4*a*c;

    if (d < -EPSILON) {
        return { type:"complex", answer:"No real roots", discriminant:checked(d) };
    }

    if (Math.abs(d) <= EPSILON) {
        return {
            type:"quadratic",
            answer:[checked(-b/(2*a))],
            discriminant:0
        };
    }

    return {
        type:"quadratic",
        answer:[
            checked((-b+Math.sqrt(d))/(2*a)),
            checked((-b-Math.sqrt(d))/(2*a))
        ],
        discriminant:checked(d)
    };
}

function solveSystem2x2(a1,b1,c1,a2,b2,c2) {
    if (![a1,b1,c1,a2,b2,c2].every(valid)) {
        throw new Error("Invalid coefficients.");
    }

    const d = a1*b2-a2*b1;

    if (Math.abs(d) < EPSILON) {
        return { type:"no-unique-solution", answer:null };
    }

    return {
        type:"system",
        answer:{
            x:checked((c1*b2-c2*b1)/d),
            y:checked((a1*c2-a2*c1)/d)
        }
    };
}

function cleanPolynomial(poly) {
    if (!Array.isArray(poly) || !poly.length || poly.length > 51) {
        throw new Error("Invalid polynomial.");
    }

    const result = poly.map(n => {
        if (!valid(n)) throw new Error("Invalid coefficient.");
        return checked(n);
    });

    while (result.length > 1 && Math.abs(result.at(-1)) < EPSILON) {
        result.pop();
    }

    return result;
}

function polynomialAdd(p,q) {
    p = cleanPolynomial(p);
    q = cleanPolynomial(q);

    return cleanPolynomial(
        Array.from(
            {length:Math.max(p.length,q.length)},
            (_,i)=>(p[i]||0)+(q[i]||0)
        )
    );
}

function polynomialMultiply(p,q) {
    p = cleanPolynomial(p);
    q = cleanPolynomial(q);

    const result = Array(p.length+q.length-1).fill(0);

    p.forEach((a,i)=>q.forEach((b,j)=>{
        result[i+j] += a*b;
    }));

    return cleanPolynomial(result);
}

function polynomialEvaluate(poly,x) {
    poly = cleanPolynomial(poly);
    if (!valid(x)) throw new Error("Invalid x value.");

    let result = 0;
    for (let i=poly.length-1;i>=0;i--) {
        result = result*x+poly[i];
    }
    return checked(result);
}

// PART 1 END

/* =====================================================
   PART 2/5 — NUMBER THEORY + ADVANCED ARITHMETIC
   ===================================================== */

// ---------- NUMBER THEORY ----------

function hcf(...numbers) {
    if (!numbers.length || !numbers.every(Number.isSafeInteger)) {
        throw new Error("HCF requires integers.");
    }

    return numbers.reduce((a,b)=>gcd(a,b));
}

function lcmMany(...numbers) {
    if (!numbers.length || !numbers.every(Number.isSafeInteger)) {
        throw new Error("LCM requires integers.");
    }

    return numbers.reduce((a,b)=>lcm(a,b));
}

function divisors(n) {
    if (!Number.isSafeInteger(n) || n < 1) {
        throw new Error("Enter a positive integer.");
    }

    const result = [];

    for (let i=1;i<=Math.sqrt(n);i++) {
        if (n%i===0) {
            result.push(i);
            if (i!==n/i) result.push(n/i);
        }
    }

    return result.sort((a,b)=>a-b);
}

function primeFactorization(n) {
    return primeFactors(n);
}

function isPerfectSquare(n) {
    if (!Number.isSafeInteger(n) || n<0) return false;
    return Number.isInteger(Math.sqrt(n));
}

function isPerfectCube(n) {
    if (!Number.isSafeInteger(n)) return false;
    return Math.round(Math.cbrt(n)) ** 3 === n;
}

// ---------- FRACTIONS ----------

function fraction(numerator,denominator) {
    if (!Number.isSafeInteger(numerator) ||
        !Number.isSafeInteger(denominator) ||
        denominator===0) {
        throw new Error("Invalid fraction.");
    }

    const sign = denominator<0 ? -1 : 1;
    const divisor = gcd(numerator,denominator);

    return {
        numerator:sign*numerator/divisor,
        denominator:Math.abs(denominator)/divisor
    };
}

function fractionAdd(a,b) {
    return fraction(
        a.numerator*b.denominator+b.numerator*a.denominator,
        a.denominator*b.denominator
    );
}

function fractionSubtract(a,b) {
    return fraction(
        a.numerator*b.denominator-b.numerator*a.denominator,
        a.denominator*b.denominator
    );
}

function fractionMultiply(a,b) {
    return fraction(
        a.numerator*b.numerator,
        a.denominator*b.denominator
    );
}

function fractionDivide(a,b) {
    if (b.numerator===0) throw new Error("Division by zero.");

    return fraction(
        a.numerator*b.denominator,
        a.denominator*b.numerator
    );
}

// ---------- PERCENTAGE ----------

function percentage(value,total) {
    if (!valid(value)||!valid(total)||total===0) {
        throw new Error("Invalid percentage values.");
    }

    return checked(value/total*100);
}

function percentageOf(percent,total) {
    if (!valid(percent)||!valid(total)) {
        throw new Error("Invalid values.");
    }

    return checked(percent*total/100);
}

function percentageChange(oldValue,newValue) {
    if (!valid(oldValue)||!valid(newValue)||oldValue===0) {
        throw new Error("Old value cannot be zero.");
    }

    return checked((newValue-oldValue)/Math.abs(oldValue)*100);
}

// ---------- RATIO ----------

function simplifyRatio(a,b) {
    if (!Number.isSafeInteger(a)||!Number.isSafeInteger(b)) {
        throw new Error("Ratio requires integers.");
    }

    if (a===0&&b===0) throw new Error("Invalid ratio.");

    const divisor = gcd(a,b);

    return {
        first:a/divisor,
        second:b/divisor
    };
}

function divideInRatio(total,a,b) {
    if (!valid(total)||!Number.isFinite(a)||!Number.isFinite(b) ||
        a<0||b<0||a+b===0) {
        throw new Error("Invalid ratio.");
    }

    return {
        first:checked(total*a/(a+b)),
        second:checked(total*b/(a+b))
    };
}

// ---------- PROFIT / LOSS / DISCOUNT ----------

function profitLoss(costPrice,sellingPrice) {
    if (!valid(costPrice)||!valid(sellingPrice)||costPrice<=0) {
        throw new Error("Invalid price.");
    }

    const difference = sellingPrice-costPrice;

    return {
        type:difference>0?"profit":difference<0?"loss":"no-profit-no-loss",
        amount:checked(Math.abs(difference)),
        percentage:checked(Math.abs(difference)/costPrice*100)
    };
}

function discount(originalPrice,discountPercent) {
    if (!valid(originalPrice)||!valid(discountPercent) ||
        originalPrice<0||discountPercent<0||discountPercent>100) {
        throw new Error("Invalid discount.");
    }

    const amount = originalPrice*discountPercent/100;

    return {
        discountAmount:checked(amount),
        finalPrice:checked(originalPrice-amount)
    };
}

// ---------- INTEREST ----------

function simpleInterest(principal,rate,time) {
    if (![principal,rate,time].every(valid) ||
        principal<0||rate<0||time<0) {
        throw new Error("Invalid interest values.");
    }

    const interest = principal*rate*time/100;

    return {
        interest:checked(interest),
        total:checked(principal+interest)
    };
}

function compoundInterest(principal,rate,time,frequency) {
    frequency = frequency===undefined ? 1 : frequency;

    if (![principal,rate,time,frequency].every(valid) ||
        principal<0||rate<0||time<0||frequency<=0) {
        throw new Error("Invalid compound interest values.");
    }

    const amount = principal*Math.pow(
        1+rate/(100*frequency),
        frequency*time
    );

    return {
        interest:checked(amount-principal),
        total:checked(amount)
    };
}

// ---------- PERMUTATION / COMBINATION ----------

function permutation(n,r) {
    if (!Number.isInteger(n)||!Number.isInteger(r)||
        n<0||r<0||r>n) {
        throw new Error("Invalid n or r.");
    }

    let result = 1;

    for (let i=0;i<r;i++) {
        result *= n-i;
        if (!Number.isFinite(result)) {
            throw new Error("Result too large.");
        }
    }

    return checked(result);
}

function combination(n,r) {
    if (!Number.isInteger(n)||!Number.isInteger(r)||
        n<0||r<0||r>n) {
        throw new Error("Invalid n or r.");
    }

    r = Math.min(r,n-r);

    let result = 1;

    for (let i=1;i<=r;i++) {
        result = result*(n-r+i)/i;
        if (!Number.isFinite(result)) {
            throw new Error("Result too large.");
        }
    }

    return checked(result);
}

// ---------- POLYNOMIAL FACTORIZATION ----------
// Coefficients are stored in ascending order.
// Example: x² - 5x + 6 = [6,-5,1]

function factorPolynomial(poly) {
    poly = cleanPolynomial(poly);

    if (!poly.every(Number.isInteger)) {
        return {
            success:false,
            message:"Integer coefficients are required."
        };
    }

    if (poly.length<2||poly.length>21) {
        throw new Error("Unsupported polynomial degree.");
    }

    const constant = Math.abs(poly[0]);
    const leading = Math.abs(poly[poly.length-1]);

    if (leading===0||constant>1000000||leading>1000000) {
        throw new Error("Coefficients are outside the supported range.");
    }

    function getDivisors(n) {
        if (n===0) return [0];

        const result = [];

        for (let i=1;i<=n;i++) {
            if (n%i===0) result.push(i);
        }

        return result;
    }

    const candidates = new Set();

    if (constant===0) {
        candidates.add(0);
    } else {
        const pValues = getDivisors(constant);
        const qValues = getDivisors(leading);

        pValues.forEach(p=>{
            qValues.forEach(q=>{
                candidates.add(p/q);
                candidates.add(-p/q);
            });
        });
    }

    let remaining = poly.slice();
    const roots = [];

    for (const root of candidates) {
        while (
            remaining.length>1 &&
            Math.abs(polynomialEvaluate(remaining,root))<EPSILON
        ) {
            roots.push(checked(root));

            const quotient = Array(remaining.length-1).fill(0);

            quotient[quotient.length-1] =
                remaining[remaining.length-1];

            for (let i=quotient.length-2;i>=0;i--) {
                quotient[i] =
                    remaining[i+1]+root*quotient[i+1];
            }

            remaining = cleanPolynomial(quotient);
        }
    }

    return {
        success:roots.length>0,
        roots:roots,
        remainingCoefficients:remaining,
        message:roots.length
            ? "Rational roots found."
            : "No rational roots found."
    };
}

// PART 2 END

/* =====================================================
   PART 3/5 — GEOMETRY + MENSURATION
   ===================================================== */

const Geometry = Object.freeze({

    // ---------- 2D SHAPES ----------

    square(side) {
        if (!valid(side)||side<0) throw new Error("Invalid side.");

        return {
            area:checked(side*side),
            perimeter:checked(4*side),
            diagonal:checked(side*Math.sqrt(2))
        };
    },

    rectangle(length,width) {
        if (![length,width].every(valid)||length<0||width<0)
            throw new Error("Invalid dimensions.");

        return {
            area:checked(length*width),
            perimeter:checked(2*(length+width)),
            diagonal:checked(Math.hypot(length,width))
        };
    },

    triangle(base,height) {
        if (![base,height].every(valid)||base<0||height<0)
            throw new Error("Invalid dimensions.");

        return {
            area:checked(base*height/2)
        };
    },

    triangleSides(a,b,c) {
        if (![a,b,c].every(valid)||a<=0||b<=0||c<=0||
            a+b<=c||a+c<=b||b+c<=a) {
            throw new Error("Invalid triangle sides.");
        }

        const s=(a+b+c)/2;

        return {
            perimeter:checked(a+b+c),
            area:checked(Math.sqrt(s*(s-a)*(s-b)*(s-c)))
        };
    },

    circle(radius) {
        if (!valid(radius)||radius<0)
            throw new Error("Invalid radius.");

        return {
            area:checked(Math.PI*radius*radius),
            circumference:checked(2*Math.PI*radius),
            diameter:checked(2*radius)
        };
    },

    semicircle(radius) {
        if (!valid(radius)||radius<0)
            throw new Error("Invalid radius.");

        return {
            area:checked(Math.PI*radius*radius/2),
            perimeter:checked(Math.PI*radius+2*radius)
        };
    },

    parallelogram(base,height,side) {
        if (![base,height,side].every(valid)||
            base<0||height<0||side<0)
            throw new Error("Invalid dimensions.");

        return {
            area:checked(base*height),
            perimeter:checked(2*(base+side))
        };
    },

    trapezium(a,b,height,side1,side2) {
        if (![a,b,height,side1,side2].every(valid)||
            [a,b,height,side1,side2].some(n=>n<0))
            throw new Error("Invalid dimensions.");

        return {
            area:checked((a+b)*height/2),
            perimeter:checked(a+b+side1+side2)
        };
    },

    rhombus(diagonal1,diagonal2,side) {
        if (![diagonal1,diagonal2,side].every(valid)||
            diagonal1<0||diagonal2<0||side<0)
            throw new Error("Invalid dimensions.");

        return {
            area:checked(diagonal1*diagonal2/2),
            perimeter:checked(4*side)
        };
    },

    regularPolygon(sides,length) {
        if (!Number.isInteger(sides)||sides<3||
            !valid(length)||length<0)
            throw new Error("Invalid polygon.");

        const perimeter=sides*length;

        return {
            perimeter:checked(perimeter),
            area:checked(
                sides*length*length/
                (4*Math.tan(Math.PI/sides))
            )
        };
    },

    // ---------- 3D SHAPES ----------

    cube(side) {
        if (!valid(side)||side<0)
            throw new Error("Invalid side.");

        return {
            volume:checked(side**3),
            surfaceArea:checked(6*side**2),
            lateralSurfaceArea:checked(4*side**2),
            diagonal:checked(side*Math.sqrt(3))
        };
    },

    cuboid(length,width,height) {
        if (![length,width,height].every(valid)||
            [length,width,height].some(n=>n<0))
            throw new Error("Invalid dimensions.");

        return {
            volume:checked(length*width*height),
            surfaceArea:checked(
                2*(length*width+width*height+height*length)
            ),
            lateralSurfaceArea:checked(
                2*height*(length+width)
            ),
            diagonal:checked(Math.hypot(length,width,height))
        };
    },

    sphere(radius) {
        if (!valid(radius)||radius<0)
            throw new Error("Invalid radius.");

        return {
            volume:checked(4*Math.PI*radius**3/3),
            surfaceArea:checked(4*Math.PI*radius**2)
        };
    },

    hemisphere(radius) {
        if (!valid(radius)||radius<0)
            throw new Error("Invalid radius.");

        return {
            volume:checked(2*Math.PI*radius**3/3),
            curvedSurfaceArea:checked(2*Math.PI*radius**2),
            totalSurfaceArea:checked(3*Math.PI*radius**2)
        };
    },

    cylinder(radius,height) {
        if (![radius,height].every(valid)||radius<0||height<0)
            throw new Error("Invalid dimensions.");

        return {
            volume:checked(Math.PI*radius**2*height),
            curvedSurfaceArea:checked(2*Math.PI*radius*height),
            totalSurfaceArea:checked(
                2*Math.PI*radius*(radius+height)
            )
        };
    },

    cone(radius,height,slantHeight) {
        if (![radius,height].every(valid)||radius<0||height<0)
            throw new Error("Invalid dimensions.");

        const slant=slantHeight===undefined
            ? Math.hypot(radius,height)
            : slantHeight;

        if (!valid(slant)||slant<0)
            throw new Error("Invalid slant height.");

        return {
            volume:checked(Math.PI*radius**2*height/3),
            curvedSurfaceArea:checked(Math.PI*radius*slant),
            totalSurfaceArea:checked(
                Math.PI*radius*(radius+slant)
            ),
            slantHeight:checked(slant)
        };
    },

    // ---------- PYTHAGORAS ----------

    pythagoras(a,b) {
        if (![a,b].every(valid)||a<0||b<0)
            throw new Error("Invalid sides.");

        return {
            hypotenuse:checked(Math.hypot(a,b))
        };
    },

    missingLeg(hypotenuse,leg) {
        if (![hypotenuse,leg].every(valid)||
            hypotenuse<0||leg<0||leg>hypotenuse)
            throw new Error("Invalid triangle sides.");

        return {
            missingSide:checked(
                Math.sqrt(hypotenuse**2-leg**2)
            )
        };
    },

    // ---------- ANGLES ----------

    degreesToRadians(degrees) {
        if (!valid(degrees)) throw new Error("Invalid angle.");
        return checked(degrees*Math.PI/180);
    },

    radiansToDegrees(radians) {
        if (!valid(radians)) throw new Error("Invalid angle.");
        return checked(radians*180/Math.PI);
    }

});

// PART 3 END

/* =====================================================
   PART 4/5 — TRIGONOMETRY + CALCULUS + STATISTICS
   ===================================================== */

// ---------- ADVANCED TRIGONOMETRY ----------

const Trigonometry = Object.freeze({

    sin(degrees) {
        if (!valid(degrees)) throw new Error("Invalid angle.");
        return checked(Math.sin(toRadians(degrees)));
    },

    cos(degrees) {
        if (!valid(degrees)) throw new Error("Invalid angle.");
        return checked(Math.cos(toRadians(degrees)));
    },

    tan(degrees) {
        if (!valid(degrees)) throw new Error("Invalid angle.");

        if (Math.abs(Math.cos(toRadians(degrees))) < EPSILON) {
            throw new Error("Tangent is undefined at this angle.");
        }

        return checked(Math.tan(toRadians(degrees)));
    },

    cot(degrees) {
        const value = this.tan(degrees);
        if (Math.abs(value) < EPSILON) {
            throw new Error("Cotangent is undefined.");
        }
        return checked(1/value);
    },

    sec(degrees) {
        const value = this.cos(degrees);
        if (Math.abs(value) < EPSILON) {
            throw new Error("Secant is undefined.");
        }
        return checked(1/value);
    },

    cosec(degrees) {
        const value = this.sin(degrees);
        if (Math.abs(value) < EPSILON) {
            throw new Error("Cosecant is undefined.");
        }
        return checked(1/value);
    },

    asin(value) {
        if (!valid(value)||value < -1||value > 1)
            throw new Error("Input must be between -1 and 1.");
        return checked(Math.asin(value)*180/Math.PI);
    },

    acos(value) {
        if (!valid(value)||value < -1||value > 1)
            throw new Error("Input must be between -1 and 1.");
        return checked(Math.acos(value)*180/Math.PI);
    },

    atan(value) {
        if (!valid(value)) throw new Error("Invalid value.");
        return checked(Math.atan(value)*180/Math.PI);
    },

    // Sine rule: a/sin(A) = b/sin(B)
    sineRule(sideA, angleA, angleB) {
        if (![sideA,angleA,angleB].every(valid) ||
            sideA<=0 || angleA<=0 || angleB<=0 ||
            angleA+angleB>=180) {
            throw new Error("Invalid triangle values.");
        }

        return {
            sideB:checked(
                sideA*Math.sin(toRadians(angleB))/
                Math.sin(toRadians(angleA))
            )
        };
    },

    // Cosine rule: c² = a² + b² - 2ab cos(C)
    cosineRule(a,b,angleC) {
        if (![a,b,angleC].every(valid) ||
            a<=0 || b<=0 || angleC<=0 || angleC>=180) {
            throw new Error("Invalid triangle values.");
        }

        return {
            sideC:checked(Math.sqrt(
                a*a+b*b-2*a*b*Math.cos(toRadians(angleC))
            ))
        };
    },

    // Find third angle of a triangle.
    thirdAngle(angleA,angleB) {
        if (![angleA,angleB].every(valid) ||
            angleA<=0 || angleB<=0 || angleA+angleB>=180) {
            throw new Error("Invalid angles.");
        }

        return checked(180-angleA-angleB);
    }

});

// ---------- CALCULUS ----------

// Numerical differentiation using central difference.
// f must be a function supplied by the program,
// not text entered by the user.
function derivative(f,x,h) {
    h = h===undefined ? 0.0001 : h;

    if (typeof f!=="function" ||
        !valid(x) || !valid(h) || h<=0) {
        throw new Error("Invalid differentiation input.");
    }

    const left = f(x-h);
    const right = f(x+h);

    if (!valid(left)||!valid(right)) {
        throw new Error("Function returned an invalid value.");
    }

    return checked((right-left)/(2*h));
}

// Numerical second derivative.
function secondDerivative(f,x,h) {
    h = h===undefined ? 0.001 : h;

    if (typeof f!=="function" ||
        !valid(x) || !valid(h) || h<=0) {
        throw new Error("Invalid differentiation input.");
    }

    const center = f(x);
    const left = f(x-h);
    const right = f(x+h);

    if (![center,left,right].every(valid)) {
        throw new Error("Function returned an invalid value.");
    }

    return checked((right-2*center+left)/(h*h));
}

// Simpson's numerical integration.
// n must be an even positive integer.
function integrate(f,a,b,n) {
    n = n===undefined ? 1000 : n;

    if (typeof f!=="function" ||
        !valid(a) || !valid(b) ||
        !Number.isInteger(n) || n<2 || n>100000 ||
        n%2!==0) {
        throw new Error("Invalid integration input.");
    }

    const h = (b-a)/n;
    let sum = f(a)+f(b);

    if (!valid(sum)) throw new Error("Invalid function value.");

    for (let i=1;i<n;i++) {
        const value = f(a+i*h);

        if (!valid(value)) {
            throw new Error("Function returned an invalid value.");
        }

        sum += (i%2===0 ? 2 : 4)*value;
    }

    return checked(sum*h/3);
}

// Numerical limit using two nearby points.
// This is an approximation, not a symbolic limit solver.
function numericalLimit(f,x,h) {
    h = h===undefined ? 0.000001 : h;

    if (typeof f!=="function" ||
        !valid(x) || !valid(h) || h<=0) {
        throw new Error("Invalid limit input.");
    }

    const left = f(x-h);
    const right = f(x+h);

    if (!valid(left)||!valid(right)) {
        throw new Error("Limit could not be approximated.");
    }

    return {
        left:checked(left),
        right:checked(right),
        estimate:checked((left+right)/2),
        note:"Numerical approximation only."
    };
}

// ---------- STATISTICS ----------

function validateData(data) {
    if (!Array.isArray(data) ||
        data.length===0 ||
        data.length>100000 ||
        !data.every(valid)) {
        throw new Error("Enter a non-empty array of finite numbers.");
    }

    return data.slice();
}

function mean(data) {
    data=validateData(data);

    return checked(
        data.reduce((sum,n)=>sum+n,0)/data.length
    );
}

function median(data) {
    data=validateData(data).sort((a,b)=>a-b);

    const middle=Math.floor(data.length/2);

    if (data.length%2===1) return checked(data[middle]);

    return checked((data[middle-1]+data[middle])/2);
}

function mode(data) {
    data=validateData(data);

    const counts=new Map();

    data.forEach(n=>{
        counts.set(n,(counts.get(n)||0)+1);
    });

    const maximum=Math.max(...counts.values());

    if (maximum===1) return [];

    return Array.from(counts.entries())
        .filter(item=>item[1]===maximum)
        .map(item=>item[0])
        .sort((a,b)=>a-b);
}

function variance(data,sample) {
    data=validateData(data);

    if (sample && data.length<2) {
        throw new Error("Sample variance requires at least two values.");
    }

    const average=mean(data);

    const squaredDifferences=data.reduce(
        (sum,n)=>sum+(n-average)**2,0
    );

    return checked(
        squaredDifferences/(sample?data.length-1:data.length)
    );
}

function standardDeviation(data,sample) {
    return checked(Math.sqrt(variance(data,sample)));
}

function range(data) {
    data=validateData(data);

    return checked(Math.max(...data)-Math.min(...data));
}

function statistics(data) {
    data=validateData(data);

    return {
        count:data.length,
        mean:mean(data),
        median:median(data),
        mode:mode(data),
        minimum:Math.min(...data),
        maximum:Math.max(...data),
        range:range(data),
        populationVariance:variance(data,false),
        populationStandardDeviation:standardDeviation(data,false)
    };
}

// PART 4 END

/* =====================================================
   PART 5/5 — MATRICES + PROBABILITY + CONVERSION
   + WORD PROBLEMS + FINAL API
   ===================================================== */

// ---------- MATRIX VALIDATION ----------

function validateMatrix(matrix) {
    if (!Array.isArray(matrix) ||
        matrix.length===0 ||
        matrix.length>50 ||
        !matrix.every(row=>
            Array.isArray(row) &&
            row.length===matrix[0].length &&
            row.length>0 &&
            row.every(valid)
        )) {
        throw new Error("Invalid matrix.");
    }

    return matrix.map(row=>row.slice());
}

// ---------- MATRIX OPERATIONS ----------

function matrixAdd(a,b) {
    a=validateMatrix(a);
    b=validateMatrix(b);

    if (a.length!==b.length ||
        a[0].length!==b[0].length) {
        throw new Error("Matrix dimensions must match.");
    }

    return a.map((row,i)=>
        row.map((value,j)=>checked(value+b[i][j]))
    );
}

function matrixSubtract(a,b) {
    a=validateMatrix(a);
    b=validateMatrix(b);

    if (a.length!==b.length ||
        a[0].length!==b[0].length) {
        throw new Error("Matrix dimensions must match.");
    }

    return a.map((row,i)=>
        row.map((value,j)=>checked(value-b[i][j]))
    );
}

function matrixMultiply(a,b) {
    a=validateMatrix(a);
    b=validateMatrix(b);

    if (a[0].length!==b.length) {
        throw new Error("Matrix dimensions are incompatible.");
    }

    const result=Array.from(
        {length:a.length},
        ()=>Array(b[0].length).fill(0)
    );

    for (let i=0;i<a.length;i++) {
        for (let j=0;j<b[0].length;j++) {
            for (let k=0;k<b.length;k++) {
                result[i][j]+=a[i][k]*b[k][j];
            }
            result[i][j]=checked(result[i][j]);
        }
    }

    return result;
}

function matrixTranspose(matrix) {
    matrix=validateMatrix(matrix);

    return matrix[0].map((_,j)=>
        matrix.map(row=>row[j])
    );
}

function matrixDeterminant(matrix) {
    matrix=validateMatrix(matrix);

    const n=matrix.length;

    if (matrix[0].length!==n) {
        throw new Error("Determinant requires a square matrix.");
    }

    const a=matrix.map(row=>row.slice());
    let determinant=1;

    for (let i=0;i<n;i++) {
        let pivot=i;

        for (let j=i+1;j<n;j++) {
            if (Math.abs(a[j][i])>Math.abs(a[pivot][i])) {
                pivot=j;
            }
        }

        if (Math.abs(a[pivot][i])<EPSILON) return 0;

        if (pivot!==i) {
            [a[i],a[pivot]]=[a[pivot],a[i]];
            determinant*=-1;
        }

        const value=a[i][i];
        determinant*=value;

        for (let j=i+1;j<n;j++) {
            const factor=a[j][i]/value;

            for (let k=i+1;k<n;k++) {
                a[j][k]-=factor*a[i][k];
            }
        }
    }

    return checked(determinant);
}

function matrixInverse(matrix) {
    matrix=validateMatrix(matrix);

    const n=matrix.length;

    if (matrix[0].length!==n) {
        throw new Error("Inverse requires a square matrix.");
    }

    const a=matrix.map((row,i)=>
        row.concat(
            Array.from({length:n},(_,j)=>i===j?1:0)
        )
    );

    for (let i=0;i<n;i++) {
        let pivot=i;

        for (let j=i+1;j<n;j++) {
            if (Math.abs(a[j][i])>Math.abs(a[pivot][i])) {
                pivot=j;
            }
        }

        if (Math.abs(a[pivot][i])<EPSILON) {
            throw new Error("Matrix is singular; inverse does not exist.");
        }

        [a[i],a[pivot]]=[a[pivot],a[i]];

        const divisor=a[i][i];

        for (let j=0;j<2*n;j++) {
            a[i][j]/=divisor;
        }

        for (let k=0;k<n;k++) {
            if (k===i) continue;

            const factor=a[k][i];

            for (let j=0;j<2*n;j++) {
                a[k][j]-=factor*a[i][j];
            }
        }
    }

    return a.map(row=>
        row.slice(n).map(checked)
    );
}

// ---------- PROBABILITY ----------

function probability(favourable,total) {
    if (!valid(favourable)||!valid(total)||
        total<=0||favourable<0||favourable>total) {
        throw new Error("Invalid probability values.");
    }

    return {
        fraction:fraction(
            Math.round(favourable),
            Math.round(total)
        ),
        decimal:checked(favourable/total),
        percentage:checked(favourable/total*100)
    };
}

function conditionalProbability(intersection,event) {
    if (!valid(intersection)||!valid(event)||
        event<=0||intersection<0||intersection>event) {
        throw new Error("Invalid conditional probability values.");
    }

    return checked(intersection/event);
}

function complementProbability(p) {
    if (!valid(p)||p<0||p>1) {
        throw new Error("Probability must be between 0 and 1.");
    }

    return checked(1-p);
}

// ---------- UNIT CONVERSION ----------

const UNIT_TABLE=Object.freeze({
    length:{
        m:1, meter:1, metre:1,
        km:1000, kilometer:1000, kilometre:1000,
        cm:0.01, mm:0.001,
        mile:1609.344,
        foot:0.3048, ft:0.3048,
        inch:0.0254, in:0.0254
    },
    mass:{
        kg:1, kilogram:1,
        g:0.001, gram:0.001,
        mg:0.000001,
        tonne:1000, ton:1000,
        pound:0.45359237, lb:0.45359237
    },
    time:{
        second:1, seconds:1, sec:1, s:1,
        minute:60, minutes:60, min:60,
        hour:3600, hours:3600, hr:3600,
        day:86400, days:86400
    },
    speed:{
        "m/s":1,
        "km/h":1/3.6,
        "mph":0.44704
    }
});

function convertUnit(value,from,to,category) {
    if (!valid(value)) throw new Error("Invalid value.");

    from=String(from).toLowerCase();
    to=String(to).toLowerCase();
    category=String(category).toLowerCase();

    if (category==="temperature") {
        let celsius;

        if (from==="c"||from==="celsius") celsius=value;
        else if (from==="f"||from==="fahrenheit")
            celsius=(value-32)*5/9;
        else if (from==="k"||from==="kelvin")
            celsius=value-273.15;
        else throw new Error("Unknown temperature unit.");

        if (to==="c"||to==="celsius") return checked(celsius);
        if (to==="f"||to==="fahrenheit")
            return checked(celsius*9/5+32);
        if (to==="k"||to==="kelvin")
            return checked(celsius+273.15);

        throw new Error("Unknown temperature unit.");
    }

    const table=UNIT_TABLE[category];

    if (!table||table[from]===undefined||table[to]===undefined) {
        throw new Error("Unsupported unit conversion.");
    }

    return checked(value*table[from]/table[to]);
}

// ---------- AVERAGE ----------

function average(numbers) {
    return mean(numbers);
}

// ---------- SPEED, DISTANCE, TIME ----------

function speedDistanceTime(distance,time) {
    if (![distance,time].every(valid)||distance<0||time<=0) {
        throw new Error("Invalid distance or time.");
    }

    return {
        speed:checked(distance/time)
    };
}

function distanceFromSpeed(speed,time) {
    if (![speed,time].every(valid)||speed<0||time<0) {
        throw new Error("Invalid speed or time.");
    }

    return {
        distance:checked(speed*time)
    };
}

function timeFromDistance(distance,speed) {
    if (![distance,speed].every(valid)||distance<0||speed<=0) {
        throw new Error("Invalid distance or speed.");
    }

    return {
        time:checked(distance/speed)
    };
}

// Train speeds are km/h, lengths are metres.
// Result is in seconds.

function trainCrossPole(length,speed) {
    if (![length,speed].every(valid)||length<0||speed<=0) {
        throw new Error("Invalid train values.");
    }

    return {
        time:checked(length/(speed*1000/3600))
    };
}

function trainCrossPlatform(trainLength,platformLength,speed) {
    if (![trainLength,platformLength,speed].every(valid)||
        trainLength<0||platformLength<0||speed<=0) {
        throw new Error("Invalid train values.");
    }

    return {
        time:checked(
            (trainLength+platformLength)/(speed*1000/3600)
        )
    };
}

function twoTrainsCross(length1,length2,speed1,speed2,opposite) {
    if (![length1,length2,speed1,speed2].every(valid)||
        length1<0||length2<0||speed1<0||speed2<0) {
        throw new Error("Invalid train values.");
    }

    const relativeSpeed=opposite
        ? speed1+speed2
        : Math.abs(speed1-speed2);

    if (relativeSpeed===0) {
        throw new Error("Trains have no relative speed.");
    }

    return {
        time:checked(
            (length1+length2)/(relativeSpeed*1000/3600)
        )
    };
}

// ---------- WORK AND PIPES ----------
// Times must use the same unit.

function combinedWorkTime(...times) {
    if (!times.length||!times.every(n=>valid(n)&&n>0)) {
        throw new Error("Work times must be positive.");
    }

    const rate=times.reduce((sum,t)=>sum+1/t,0);

    return checked(1/rate);
}

function pipeTime(fillTimes,emptyTimes) {
    if (!Array.isArray(fillTimes)||!Array.isArray(emptyTimes)||
        !fillTimes.every(n=>valid(n)&&n>0)||
        !emptyTimes.every(n=>valid(n)&&n>0)) {
        throw new Error("Invalid pipe times.");
    }

    const rate=
        fillTimes.reduce((sum,t)=>sum+1/t,0)-
        emptyTimes.reduce((sum,t)=>sum+1/t,0);

    if (rate<=0) {
        throw new Error("The tank cannot be filled with these pipes.");
    }

    return checked(1/rate);
}

// ---------- BASIC WORD PROBLEM SUPPORT ----------

function solveWordProblem(input) {
    const text=normalizeText(input);

    let match;

    // Percentage of a number
    match=text.match(
        /(-?\d+(?:\.\d+)?)\s*%\s*(?:of|er|এর|का)\s*(-?\d+(?:\.\d+)?)/
    );

    if (match) {
        return {
            success:true,
            topic:"percentage",
            answer:percentageOf(Number(match[1]),Number(match[2]))
        };
    }

    // HCF / GCD
    match=text.match(
        /(?:hcf|gcd|গসাগু|महत्तम समापवर्तक)\s*[:=]?\s*(\d+)\s*(?:,|and|ও|और)\s*(\d+)/
    );

    if (match) {
        return {
            success:true,
            topic:"hcf",
            answer:gcd(Number(match[1]),Number(match[2]))
        };
    }

    // LCM
    match=text.match(
        /(?:lcm|লসাগু|लघुत्तम समापवर्त्य)\s*[:=]?\s*(\d+)\s*(?:,|and|ও|और)\s*(\d+)/
    );

    if (match) {
        return {
            success:true,
            topic:"lcm",
            answer:lcm(Number(match[1]),Number(match[2]))
        };
    }

    // Average
    match=text.match(
        /(?:average|mean|গড়|औसत)\s*(?:of|হলো|है)?\s*([\d.,\s]+)/
    );

    if (match) {
        const values=match[1].split(/[,\s]+/)
            .filter(Boolean).map(Number);

        if (values.length && values.every(valid)) {
            return {
                success:true,
                topic:"average",
                answer:average(values)
            };
        }
    }

    // Simple arithmetic expression
    const expression=text
        .replace(/^(?:calculate|solve|what is|কত|হিসাব করো)\s*/,"")
        .trim();

    if (/^[\d.e+\-*/%^()!\s]+$/.test(expression)) {
        try {
            return {
                success:true,
                topic:"arithmetic",
                answer:parseExpression(expression)
            };
        } catch (error) {
            return null;
        }
    }

    return null;
}

// ---------- MAIN SOLVER ----------

function solve(input) {
    if (typeof input!=="string"||!input.trim()||
        input.length>MAX_LENGTH) {
        return null;
    }

    const text=normalizeText(input);

    try {
        let match;

        // Linear equation: solve 2x + 5 = 15
        match=text.match(
            /^solve\s+([+-]?(?:\d*\.?\d+|\d*)?)\s*x\s*([+-]\s*\d+(?:\.\d+)?)?\s*=\s*([+-]?\d+(?:\.\d+)?)$/
        );

        if (match) {
            let a=match[1];
            if (a===""||a==="+") a="1";
            if (a==="-") a="-1";

            const b=match[2]
                ? Number(match[2].replace(/\s/g,""))
                : 0;

            const result=solveLinear(Number(a),b,Number(match[3]));

            return {
                success:true,
                topic:"linear equation",
                answer:result.answer,
                details:result
            };
        }

        // Quadratic equation: solve 2x^2 + 3x + 1 = 0
        match=text.match(
            /^solve\s+([+-]?\d*\.?\d+)\s*x\s*\^?\s*2\s*([+-]\s*\d*\.?\d+)?\s*x?\s*([+-]\s*\d*\.?\d+)?\s*=\s*0$/
        );

        if (match) {
            const a=Number(match[1]);

            let b=match[2]
                ? Number(match[2].replace(/\s/g,""))
                : 0;

            let c=match[3]
                ? Number(match[3].replace(/\s/g,""))
                : 0;

            if (match[2] && /x$/.test(match[2].trim())) {
                b=Number(match[2].replace(/x/g,"").replace(/\s/g,""));
            }

            const result=solveQuadratic(a,b,c);

            return {
                success:true,
                topic:"quadratic equation",
                answer:result.answer,
                details:result
            };
        }

        const wordResult=solveWordProblem(text);

        if (wordResult) return wordResult;

        // Direct calculation
        const cleaned=text
            .replace(/^(calculate|what is|solve)\s+/,"")
            .trim();

        if (cleaned && /^[\d.e+\-*/%^()!\s]+$/.test(cleaned)) {
            return {
                success:true,
                topic:"arithmetic",
                answer:parseExpression(cleaned)
            };
        }

        return null;

    } catch (error) {
        console.error("Pownin solve error:",error);
        return {
            success:false,
            error:error.message
        };
    }
}

// ---------- CALCULATOR COMPATIBILITY ----------

function calculate(input) {
    if (typeof input!=="string"||!input.trim()||
        input.length>MAX_LENGTH) {
        return null;
    }

    const text=normalizeText(input)
        .replace(/^(calculate|what is)\s+/,"")
        .trim();

    try {
        if (!/^[\d.ea-z+\-*/%^(),!\s]+$/i.test(text)) {
            return null;
        }

        return parseExpression(text);
    } catch (error) {
        return null;
    }
}

// ---------- FINAL PUBLIC API ----------

const api = Object.freeze({

    version:VERSION,

    // Core
    calculate:calculate,
    solve:solve,
    parseExpression:parseExpression,
    normalizeDigits:normalizeDigits,

    // Number theory
    gcd:gcd,
    hcf:hcf,
    lcm:lcm,
    lcmMany:lcmMany,
    isPrime:isPrime,
    primeFactors:primeFactors,
    primeFactorization:primeFactorization,
    divisors:divisors,
    isPerfectSquare:isPerfectSquare,
    isPerfectCube:isPerfectCube,
    factorial:factorial,

    // Algebra
    solveLinear:solveLinear,
    solveQuadratic:solveQuadratic,
    solveSystem2x2:solveSystem2x2,
    polynomialAdd:polynomialAdd,
    polynomialMultiply:polynomialMultiply,
    polynomialEvaluate:polynomialEvaluate,
    factorPolynomial:factorPolynomial,

    // Fractions and arithmetic
    fraction:fraction,
    fractionAdd:fractionAdd,
    fractionSubtract:fractionSubtract,
    fractionMultiply:fractionMultiply,
    fractionDivide:fractionDivide,
    percentage:percentage,
    percentageOf:percentageOf,
    percentageChange:percentageChange,
    simplifyRatio:simplifyRatio,
    divideInRatio:divideInRatio,
    profitLoss:profitLoss,
    discount:discount,
    simpleInterest:simpleInterest,
    compoundInterest:compoundInterest,
    permutation:permutation,
    combination:combination,

    // Geometry
    geometry:Geometry,

    // Trigonometry
    trigonometry:Trigonometry,

    // Calculus
    derivative:derivative,
    secondDerivative:secondDerivative,
    integrate:integrate,
    numericalLimit:numericalLimit,

    // Statistics
    mean:mean,
    average:average,
    median:median,
    mode:mode,
    variance:variance,
    standardDeviation:standardDeviation,
    range:range,
    statistics:statistics,

    // Matrices
    matrixAdd:matrixAdd,
    matrixSubtract:matrixSubtract,
    matrixMultiply:matrixMultiply,
    matrixTranspose:matrixTranspose,
    matrixDeterminant:matrixDeterminant,
    matrixInverse:matrixInverse,

    // Probability
    probability:probability,
    conditionalProbability:conditionalProbability,
    complementProbability:complementProbability,

    // Conversion
    convertUnit:convertUnit,

    // Speed, distance and work
    speedDistanceTime:speedDistanceTime,
    distanceFromSpeed:distanceFromSpeed,
    timeFromDistance:timeFromDistance,
    trainCrossPole:trainCrossPole,
    trainCrossPlatform:trainCrossPlatform,
    twoTrainsCross:twoTrainsCross,
    combinedWorkTime:combinedWorkTime,
    pipeTime:pipeTime,

    // Word problems
    solveWordProblem:solveWordProblem
});

window.PowninMath=api;

console.log("POWNIN ADVANCED MATH ENGINE v"+VERSION+" LOADED");

})();



 
