from flask import Flask, request, jsonify
from mlx_lm import load, generate
import mlx.core as mx

app = Flask(__name__)

# Load model once on startup with optimizations
print("Loading MLX model...")
model, tokenizer = load("mlx-community/Llama-3.2-3B-Instruct-4bit")

# Enable GPU and optimize model
mx.metal.set_memory_limit(4 * 1024 * 1024 * 1024)  # 4GB limit
print(f"Using device: {mx.default_device()}")
print("Model loaded successfully!")

@app.route('/categorize', methods=['POST'])
def categorize():
    import time
    start_time = time.time()
    data = request.json
    
    # Handle both single and batch requests
    if 'messages' in data:
        messages = data['messages']
    else:
        messages = [{"role": "user", "content": data.get('prompt', '')}]
    
    # Apply chat template with explicit system/user separation
    if tokenizer.chat_template is not None:
        prompt = tokenizer.apply_chat_template(
            messages, 
            add_generation_prompt=True,
            tokenize=False
        )
    else:
        # Fallback: manual system/user formatting
        system_msg = ""
        user_msg = ""
        for msg in messages:
            if msg['role'] == 'system':
                system_msg = msg['content']
            elif msg['role'] == 'user':
                user_msg = msg['content']
        prompt = f"System: {system_msg}\n\nUser: {user_msg}\n\nAssistant:"
    
    # Generate response with optimized parameters
    response = generate(
        model, 
        tokenizer, 
        prompt=prompt, 
        verbose=False
    )
    
    processing_time = time.time() - start_time
    print(f"Generated response in {processing_time:.2f}s")
    
    return jsonify({
        "choices": [{
            "message": {
                "content": response.strip()
            }
        }]
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "model": "mlx-community/Llama-3.2-3B-Instruct-4bit"})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8000, debug=False) 