from setuptools import setup, find_packages

setup(
    name="bici-flask-auth",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "Flask",
        "requests",
        "PyJWT",
        "cryptography",
        "certifi"
    ],
)
