// Configuración de Supabase
const SUPABASE_URL = "https://vglmntfriibhfatkwjjw.supabase.co";
const SUPABASE_KEY = "sb_publishable_J63LijhEuBpPkllUYT8sHQ_g2pgTGLL";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Alternar entre Login y Registro de Comprador
function mostrarRegistro(verRegistro) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (verRegistro) {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    }
}

// Registrar un nuevo usuario Comprador
async function registrarComprador() {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!nombre || !email || !password) {
        alert("Por favor completa todos los campos.");
        return;
    }

    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (authError) {
        alert("Error al registrarse: " + authError.message);
        return;
    }

    const userId = authData.user?.id;
    if (!userId) {
        alert("Registro iniciado. Revisa tu correo si requiere confirmación.");
        return;
    }

    // Buscar ID del rol Comprador
    const { data: rolData, error: rolError } = await supabaseClient
        .from('roles')
        .select('id')
        .eq('nombre', 'Comprador')
        .single();

    if (rolError || !rolData) {
        alert("Error asignando el rol de comprador en la base de datos.");
        return;
    }

    // Insertar en la tabla publica `usuarios`
    const { error: userTableError } = await supabaseClient
        .from('usuarios')
        .insert([{
            id: userId,
            nombre: nombre,
            rol_id: rolData.id
        }]);

    if (userTableError) {
        alert("Error al guardar perfil de usuario: " + userTableError.message);
        return;
    }

    alert("¡Registro exitoso! Ya puedes iniciar sesión.");
    mostrarRegistro(false);
}

// Iniciar Sesión
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        alert("Error al entrar: " + error.message);
        return;
    }

    verificarSesion();
}

// Comprobar sesión activa y controlar permisos visuales según el rol
async function verificarSesion() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        // Consultar el rol del usuario conectado
        const { data: userData, error } = await supabaseClient
            .from('usuarios')
            .select(`
                nombre,
                roles:rol_id ( nombre )
            `)
            .eq('id', session.user.id)
            .single();

        let nombreRol = "Comprador";
        if (userData && userData.roles) {
            nombreRol = Array.isArray(userData.roles) ? userData.roles[0]?.nombre : userData.roles.nombre;
        }

        document.getElementById('user-info').innerText = `Conectado como: ${session.user.email} | Rol: ${nombreRol}`;

        // Contenedores protegidos por permisos de interfaz
        const formProductoContainer = document.getElementById('form-producto-container');
        const formClienteContainer = document.getElementById('form-cliente-container');

        // Ocultar por defecto
        if (formProductoContainer) formProductoContainer.style.display = 'none';
        if (formClienteContainer) formClienteContainer.style.display = 'none';

        // Mostrar según el rol correspondiente
        if (nombreRol === 'Administrador') {
            if (formProductoContainer) formProductoContainer.style.display = 'block';
            if (formClienteContainer) formClienteContainer.style.display = 'block';
        } else if (nombreRol === 'Vendedor') {
            if (formClienteContainer) formClienteContainer.style.display = 'block';
        }

        // Cargar datos iniciales
        cargarProductos();
        cargarClientes();
        cargarCotizaciones();
    } else {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('dashboard').style.display = 'none';
    }
}

// Cerrar Sesión
async function logout() {
    await supabaseClient.auth.signOut();
    verificarSesion();
}

// Registrar un Producto (Solo Administrador)
async function crearProducto() {
    const nombre = document.getElementById('prod-nombre').value;
    const descripcion = document.getElementById('prod-descripcion').value;
    const cantidad = parseInt(document.getElementById('prod-cantidad').value);
    const precio_base = parseFloat(document.getElementById('prod-precio').value);
    const ganancia_porcentaje = parseFloat(document.getElementById('prod-ganancia').value);

    if (!nombre || isNaN(cantidad) || isNaN(precio_base)) {
        alert("Por favor completa los campos obligatorios.");
        return;
    }

    const { error } = await supabaseClient
        .from('productos')
        .insert([{ 
            nombre, 
            descripcion, 
            cantidad, 
            precio_base, 
            ganancia_porcentaje: isNaN(ganancia_porcentaje) ? 0 : ganancia_porcentaje 
        }]);

    if (error) {
        alert("Error al guardar producto (¿Permisos de Admin?): " + error.message);
        return;
    }

    alert("¡Producto registrado con éxito!");
    document.getElementById('prod-nombre').value = '';
    document.getElementById('prod-descripcion').value = '';
    document.getElementById('prod-cantidad').value = '';
    document.getElementById('prod-precio').value = '';
    document.getElementById('prod-ganancia').value = '';

    cargarProductos();
}

// Cargar Productos en tabla y selectores
async function cargarProductos() {
    const { data, error } = await supabaseClient.from('productos').select('*');
    if (error) return;

    const tbody = document.getElementById('tabla-productos');
    const selectProducto = document.getElementById('cot-producto');
    
    if (tbody) tbody.innerHTML = '';
    if (selectProducto) selectProducto.innerHTML = '<option value="">-- Seleccione un producto --</option>';

    if (data.length === 0 && tbody) {
        tbody.innerHTML = '<tr><td colspan="4">No hay productos en inventario.</td></tr>';
        return;
    }

    data.forEach(prod => {
        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${prod.nombre}</td>
                <td>${prod.cantidad}</td>
                <td>$${prod.precio_base}</td>
                <td>${prod.ganancia_porcentaje}%</td>
            `;
            tbody.appendChild(tr);
        }

        if (selectProducto) {
            const option = document.createElement('option');
            option.value = prod.id;
            option.textContent = `${prod.nombre} - $${prod.precio_base} (Stock: ${prod.cantidad})`;
            selectProducto.appendChild(option);
        }
    });
}

// Registrar Cliente (Admin y Vendedor)
async function crearCliente() {
    const nombre = document.getElementById('cli-nombre').value;
    const telefono = document.getElementById('cli-telefono').value;
    const correo = document.getElementById('cli-correo').value;
    const direccion = document.getElementById('cli-direccion').value;

    if (!nombre) {
        alert("El nombre del cliente es obligatorio.");
        return;
    }

    const { error } = await supabaseClient
        .from('clientes')
        .insert([{ nombre, telefono, correo, direccion }]);

    if (error) {
        alert("Error al guardar cliente: " + error.message);
        return;
    }

    alert("¡Cliente registrado con éxito!");
    document.getElementById('cli-nombre').value = '';
    document.getElementById('cli-telefono').value = '';
    document.getElementById('cli-correo').value = '';
    document.getElementById('cli-direccion').value = '';

    cargarClientes();
}

// Cargar Clientes en tabla y selector
async function cargarClientes() {
    const { data, error } = await supabaseClient.from('clientes').select('*');
    if (error) return;

    const tbody = document.getElementById('tabla-clientes');
    const selectCliente = document.getElementById('cot-cliente');

    if (tbody) tbody.innerHTML = '';
    if (selectCliente) selectCliente.innerHTML = '<option value="">-- Seleccione un cliente --</option>';

    if (data.length === 0 && tbody) {
        tbody.innerHTML = '<tr><td colspan="4">No hay clientes registrados.</td></tr>';
        return;
    }

    data.forEach(cliente => {
        if (tbody) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cliente.nombre}</td>
                <td>${cliente.telefono || 'N/A'}</td>
                <td>${cliente.correo || 'N/A'}</td>
                <td>${cliente.direccion || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        }

        if (selectCliente) {
            const option = document.createElement('option');
            option.value = cliente.id;
            option.textContent = cliente.nombre;
            selectCliente.appendChild(option);
        }
    });
}

// Generar Cotización (Cálculos de Ganancia + IVA 19%)
async function generarCotizacion() {
    const clienteId = document.getElementById('cot-cliente').value;
    const productoId = document.getElementById('cot-producto').value;
    const cantidad = parseInt(document.getElementById('cot-cantidad').value);

    // 1. Validar campos básicos vacíos o inválidos primero
    if (!clienteId || !productoId || isNaN(cantidad) || cantidad <= 0) {
        alert("Selecciona un cliente, un producto y una cantidad válida.");
        return;
    }

    // 2. Verificar que el usuario esté autenticado
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        alert("Usuario no autenticado.");
        return;
    }

    // 3. Obtener los datos actuales del producto desde la base de datos
    const { data: productoData, error: prodError } = await supabaseClient
        .from('productos')
        .select('*')
        .eq('id', productoId)
        .single();

    if (prodError || !productoData) {
        alert("Error al obtener datos del producto.");
        return;
    }

    // 4. Validar que el stock disponible sea suficiente
    if (cantidad > productoData.cantidad) {
        alert(`Stock insuficiente. Solo hay ${productoData.cantidad} unidades disponibles.`);
        return;
    }

    // 5. Realizar cálculos comerciales (Ganancia + IVA 19%)
    const costoBaseUnitario = Number(productoData.precio_base);
    const porcentajeGanancia = Number(productoData.ganancia_porcentaje || 0);
    
    const precioUnitarioConGanancia = costoBaseUnitario * (1 + (porcentajeGanancia / 100));
    const subtotalItem = precioUnitarioConGanancia * cantidad;
    const ivaItem = subtotalItem * 0.19; // IVA del 19%
    const totalItem = subtotalItem + ivaItem;

    // 6. Insertar la cotización principal en la tabla `cotizaciones`
    const { data: cotizacionInsert, error: cotError } = await supabaseClient
        .from('cotizaciones')
        .insert([{
            cliente_id: clienteId,
            usuario_id: user.id,
            subtotal: subtotalItem,
            iva: ivaItem,
            total: totalItem
        }])
        .select()
        .single();

    if (cotError) {
        alert("Error al crear la cotización: " + cotError.message);
        return;
    }

    const nuevaCotizacionId = cotizacionInsert.id;

    // 7. Insertar el detalle de la cotización
    const { error: detError } = await supabaseClient
        .from('detalle_cotizacion')
        .insert([{
            cotizacion_id: nuevaCotizacionId,
            producto_id: productoId,
            cantidad: cantidad,
            precio_unitario: precioUnitarioConGanancia,
            iva: ivaItem,
            total: totalItem
        }]);

    if (detError) {
        alert("Error al registrar el detalle: " + detError.message);
        return;
    }

    // 8. Descontar stock del producto en la tabla `productos`
    const nuevoStock = productoData.cantidad - cantidad;
    const { error: stockError } = await supabaseClient
        .from('productos')
        .update({ cantidad: nuevoStock })
        .eq('id', productoId);

    if (stockError) {
        alert("La cotización se creó, pero hubo un error al actualizar el inventario.");
        return;
    }

    // 9. Éxito total
    alert(`¡Cotización #${nuevaCotizacionId} generada con éxito!\nSubtotal: $${subtotalItem.toFixed(2)}\nIVA (19%): $${ivaItem.toFixed(2)}\nTotal: $${totalItem.toFixed(2)}`);
    
    // Recargar la interfaz y tablas
    cargarCotizaciones();
    cargarProductos(); // Para que el stock se vea actualizado en la tabla de inventario
}

// Historial de Cotizaciones
async function cargarCotizaciones() {
    const { data, error } = await supabaseClient
        .from('cotizaciones')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) return;

    const tbody = document.getElementById('tabla-cotizaciones');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No hay cotizaciones registradas.</td></tr>';
        return;
    }

    data.forEach(cot => {
        const fechaFormateada = new Date(cot.fecha).toLocaleString();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${cot.id}</td>
            <td>${fechaFormateada}</td>
            <td>$${Number(cot.subtotal).toFixed(2)}</td>
            <td>$${Number(cot.iva).toFixed(2)}</td>
            <td><strong>$${Number(cot.total).toFixed(2)}</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

// Ejecutar verificación de sesión al iniciar la app
verificarSesion();