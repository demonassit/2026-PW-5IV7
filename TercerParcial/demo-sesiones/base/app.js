// La aplicación de la demo. server.js la arranca; las pruebas la arrancan con otras configuraciones.
// Lo que dice "(en clase)" lo programamos juntos, paso por paso. Mientras no esté, esa ruta responde 501.
const path = require('path');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { crearModeloUsuarios } = require('./modelos/usuarios.modelo');

const NOMBRE_COOKIE = 'connect.sid';

//tenemos que verificar y regresar todas las sesiones anteriores si es que existen en el almacen

function todasLasSesiones(almacen){
    return new Promise((resolve, reject) => {
        const promesa = almacen.all((error, sessiones)=> (error ? reject(error) : resolve(sessiones)));
        if (promesa && typeof promesa.then === 'function') promesa.then(resolve, reject);   
    });
}

//Necesitamos generar una respuesta a esa promesa
const pendientes = (paso) => (req, res) => res.status(501).json({error: `501. Falta programar el ${paso}`});

//vamos por la conexion los usuarios siempre deben de leer la BD
function crearApp(config, pool){
    const app = express();
    app.use(express.json());
    //mandamos a traer el modelo
    const usuarios = crearModeloUsuarios(pool);

    //aqui el servidor debe de recordar cada vez que existe una sesión, para eso vamos a ocupar el almacen

    const almacen = config.almacen === 'memoria' ? new session.MemoryStore() : new MySQLStore({createDatabaseTable: false, clearExpired: false}, pool);
    app.locals.almace = almacen;

    app.use(
        session({
            name : NOMBRE_COOKIE,
            //aqui tenemos que definir si es secreta, si es publica o como es su acceso
            secret: process.env.SESSION_SECRET || 'secreto-solo-para-demo',
            resave: false,
            saveUninitialized: false,
            rolling : config.rolling,
            cookie:{
                maxAge: config.maxAge || 1000 * 60 * 60 * 24,
                httpOnly: config.httpOnly || true,
                sameSite: config.sameSite || 'lax',
                secure: config.secure || false
            }
        })
    );

    //necesitamos los primeros 8 caracteres del id de sesion, para compartirlos en pantalla para visualizarlos, en la realidad muy pocas veces se hace esto
    const idCorto = (id) => (id ? `${id.slice(0, 8)}...` : null);

    //como estamos ocupando un middleware dentro de la app, necesitamos verificar el vencimiento de la sesión, express-session alarga por defecto el vencimiento guardadno en el servidor por cada petición aunque el rolling sea en false, si solo confiamos en esto alguien nos puede copiar la cookie y mantener vivia la sesión creando un defecto de seguridad
    function vencida(sesion){
        const desde = config.rolling ? sesion.ultimoUso : sesion.creada;
        return Date.now() - desde > config.maxAge;
    }

    //401 no estas autorizado
    function requiereSesion(req, res, next){
        if(req.session.usuario && vencida(req.session)){
            return req.session.destroy(()=>{
                res.clearCookie(NOMBRE_COOKIE);
                res.status(401).json({error: '401 tu sesion se vención vuelve a iniciar sesión'});
            });
        }
        if(!req.session.usuario){
            return res.status(401).json({error: '401 no has inicia sesion con tu usuario'});
        }
        req.session.ultimoUso = Date.now();
        next();
    }
}


